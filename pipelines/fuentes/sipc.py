"""Descarga los archivos del SIPC (Uruguay), los carga en raw y los pasa a core.

Fuente: catálogo de datos abiertos, datasets "Sistema de Información de Precios al
Consumidor" de 2025 y 2026 (Defensa del Consumidor). Hay un archivo de precios por año, que
se actualiza cada trimestre, y dos catálogos: productos y comercios. Los catálogos se toman
del año más reciente, que incluye todo lo de los anteriores.
Destino: raw.sipc_* (tal cual vienen), después core.establecimiento,
core.producto_fuente y core.precio (limpios; ver sql/transform/sipc_core.sql) y por
último el catálogo de productos genéricos (ver sql/transform/sipc_catalogo.sql) y el
recálculo de la capa mart que usa la web (ver sql/init/05_mart.sql).

Cada paso corre dentro de una transacción: si algo falla, las tablas quedan como estaban,
y volver a correrlo no duplica nada.
Solo se descarga un archivo si cambió de tamaño respecto de la copia local.

Uso:
    python -m pipelines.fuentes.sipc
    python -m pipelines.fuentes.sipc --solo productos establecimientos
    python -m pipelines.fuentes.sipc --solo core catalogo mart
    python -m pipelines.fuentes.sipc --liviano     (solo el archivo de precios más nuevo)
"""

import argparse
from pathlib import Path

import requests

DESTINO = Path("data/raw/sipc")
TRANSFORMACION = Path("sql/transform/sipc_core.sql")
CATALOGO = Path("sql/transform/sipc_catalogo.sql")
SIPC_2025 = "https://catalogodatos.gub.uy/dataset/35d8f45e-2aa7-48b5-98dd-f973b05cf8ba/resource"
SIPC_2026 = "https://catalogodatos.gub.uy/dataset/c2edcd30-8a99-45da-b208-b76056de430e/resource"

# El encabezado esperado funciona como contrato: si la fuente cambia columnas u orden,
# el pipeline se detiene en lugar de cargar datos corridos de lugar.
RECURSOS = {
    "productos": {
        "urls": [f"{SIPC_2026}/03e4e104-5a4a-4597-988f-7ba6df749ff8/download/productos.csv"],
        "encoding": "latin-1",
        "encabezado": "id.producto;producto;marca;especificacion;nombre",
        "tabla": "raw.sipc_productos",
        "opciones": "FORMAT csv, DELIMITER ';', HEADER true, ENCODING 'LATIN1'",
    },
    "establecimientos": {
        "urls": [f"{SIPC_2026}/26a1743a-2a63-4712-a220-a5a19879e748/download/establecimiento.csv"],
        "encoding": "latin-1",
        "encabezado": (
            "id.establecimientos;razon.social;nombre.sucursal;direccion;ccz;barrio;cajas;"
            "cadena;long;lat;ciudad;depto;id.depto;localidad;superficie (m2)"
        ),
        "tabla": "raw.sipc_establecimientos",
        # Desde 2026 los datos faltantes vienen como la palabra NULL (en 2025, vacíos)
        "opciones": "FORMAT csv, DELIMITER ';', HEADER true, ENCODING 'LATIN1', NULL 'NULL'",
    },
    "precios": {
        # Un archivo por año; se cargan todos juntos en la misma tabla
        "urls": [
            f"{SIPC_2025}/36c62bab-b7e4-4c9e-ad9b-4c1182090a22/download/precios_2025.csv",
            f"{SIPC_2026}/8226cb72-6ff0-4ed5-84a4-6eb7ee3be208/download/precios_2026.csv",
        ],
        "encoding": "ascii",
        "encabezado": (
            '"ID_PrecioDiario","Declaracion","Fecha","Fecha_anterior","Oferta","Precio",'
            '"PrecioAnterior","Publico","Establecimiento","Feria_id","Presentacion_Producto"'
        ),
        # Los nulos vienen como "\N" entre comillas; FORCE_NULL hace que COPY los
        # reconozca como NULL aunque estén entre comillas.
        "tabla": "raw.sipc_precios",
        "opciones": (
            r"FORMAT csv, HEADER true, NULL '\N', FORCE_NULL (declaracion, fecha, "
            "fecha_anterior, oferta, precio, precio_anterior, publico, establecimiento, "
            "feria_id, presentacion_producto)"
        ),
    },
}


def legible(bytes_: int) -> str:
    return f"{bytes_ / 1e6:,.1f} MB" if bytes_ >= 1e6 else f"{bytes_ / 1e3:,.0f} KB"


def descargar(url: str, archivo: Path) -> None:
    """Baja el archivo si no existe o si en la fuente tiene otro tamaño."""
    remoto = requests.head(url, allow_redirects=True, timeout=30)
    remoto.raise_for_status()
    tamano = int(remoto.headers.get("content-length", -1))
    if archivo.exists() and archivo.stat().st_size == tamano:
        print(f"  {archivo.name}: sin cambios ({legible(tamano)}), no se descarga")
        return

    print(f"  {archivo.name}: descargando {legible(tamano)}...")
    parcial = archivo.with_suffix(".part")
    with requests.get(url, stream=True, timeout=60) as resp:
        resp.raise_for_status()
        with open(parcial, "wb") as f:
            for bloque in resp.iter_content(chunk_size=1 << 20):
                f.write(bloque)
    # Renombrar al final evita quedarse con un archivo a medias si se corta la descarga
    parcial.replace(archivo)


def validar_encabezado(archivo: Path, encoding: str, esperado: str) -> None:
    with open(archivo, encoding=encoding) as f:
        encabezado = f.readline().strip()
    if encabezado != esperado:
        raise ValueError(
            f"{archivo.name}: cambió el formato de la fuente.\n"
            f"  esperado: {esperado}\n  recibido: {encabezado}"
        )


def cargar(conn, archivos: list[Path], tabla: str, opciones: str) -> int:
    """Reemplaza el contenido de la tabla con los archivos. Devuelve las filas cargadas."""
    filas = 0
    with conn.transaction(), conn.cursor() as cur:
        cur.execute(f"TRUNCATE {tabla}")
        for archivo in archivos:
            copy_sql = f"COPY {tabla} FROM STDIN WITH ({opciones})"
            with cur.copy(copy_sql) as copy, open(archivo, "rb") as f:
                while bloque := f.read(1 << 20):
                    copy.write(bloque)
            filas += cur.rowcount
        # Actualiza las estadísticas que usa Postgres para planificar las consultas
        cur.execute(f"ANALYZE {tabla}")
    return filas


# Cuánto se descartó o corrigió en el paso a core, para detectar si la fuente empeora
REPORTE = """
    WITH f AS (SELECT id FROM core.fuente WHERE codigo = 'sipc'),
    -- Cada precio de raw cae en una sola categoría: huérfano, inválido o candidato a core
    clasificados AS (
        SELECT (e.id_establecimiento IS NULL OR p.id_producto IS NULL) AS huerfano,
               (r.precio IS NULL OR r.precio <= 0 OR r.fecha IS NULL) AS invalido
        FROM raw.sipc_precios r
        LEFT JOIN raw.sipc_establecimientos e ON e.id_establecimiento = r.establecimiento
        LEFT JOIN raw.sipc_productos p        ON p.id_producto = r.presentacion_producto
    ),
    precios_raw AS (
        SELECT count(*)                                            AS total,
               count(*) FILTER (WHERE huerfano)                    AS huerfanos,
               count(*) FILTER (WHERE invalido AND NOT huerfano)   AS invalidos
        FROM clasificados
    )
    SELECT
        (SELECT count(*) FROM core.establecimiento e, f WHERE e.fuente_id = f.id),
        (SELECT count(*) FROM core.establecimiento e, f
          WHERE e.fuente_id = f.id AND e.ubicacion IS NULL),
        (SELECT count(*) FROM core.producto_fuente pf, f WHERE pf.fuente_id = f.id),
        (SELECT count(*) FROM core.producto_fuente pf, f
          WHERE pf.fuente_id = f.id AND pf.cantidad IS NULL),
        pr.total, pr.huerfanos, pr.invalidos,
        (SELECT count(*) FROM core.precio p
           JOIN core.producto_fuente pf ON pf.id = p.producto_fuente_id, f
          WHERE pf.fuente_id = f.id)
    FROM precios_raw pr
"""


def transformar(conn) -> None:
    """Pasa los datos de raw a core en una sola transacción e imprime el reporte."""
    with conn.transaction():
        conn.execute(TRANSFORMACION.read_text(encoding="utf-8"))

    (comercios, sin_ubicacion, productos, sin_cantidad,
     precios_raw, huerfanos, invalidos, precios_core) = conn.execute(REPORTE).fetchone()
    duplicados = precios_raw - huerfanos - invalidos - precios_core
    print(f"  comercios: {comercios:,} ({sin_ubicacion} sin ubicación válida)")
    print(f"  productos: {productos:,} ({sin_cantidad} sin cantidad reconocible)")
    print(f"  precios:   {precios_raw:>12,} en raw")
    print(f"           - {huerfanos:>12,} de comercios o productos fuera del catálogo")
    print(f"           - {invalidos:>12,} inválidos (sin fecha o precio <= 0)")
    print(f"           - {duplicados:>12,} duplicados del mismo día")
    print(f"           = {precios_core:>12,} en core")


SIN_VINCULAR = """
    SELECT pf.tipo, pf.descripcion_original, coalesce(pf.cantidad || ' ' || pf.unidad, 'sin cantidad')
    FROM core.producto_fuente pf
    JOIN core.fuente f ON f.id = pf.fuente_id AND f.codigo = 'sipc'
    LEFT JOIN core.match_producto m ON m.producto_fuente_id = pf.id
    WHERE m.producto_fuente_id IS NULL
    ORDER BY 1, 2
"""


def armar_catalogo(conn) -> None:
    """Crea los productos genéricos y los vincula con los del SIPC. Informa lo que quedó afuera."""
    with conn.transaction():
        conn.execute(CATALOGO.read_text(encoding="utf-8"))

    genericos, categorias = conn.execute(
        "SELECT count(*), count(DISTINCT categoria) FROM core.producto_canonico"
    ).fetchone()
    sin_vincular = conn.execute(SIN_VINCULAR).fetchall()
    print(f"  genéricos: {genericos} en {categorias} categorías")
    print(f"  productos sin vincular: {len(sin_vincular)} (otra unidad o sin cantidad)")
    for _, descripcion, cantidad in sin_vincular:
        print(f"    - {descripcion} ({cantidad})")


def refrescar_mart(conn) -> None:
    """Recalcula las vistas materializadas de mart (en orden: una usa la otra)."""
    with conn.transaction():
        conn.execute("REFRESH MATERIALIZED VIEW mart.precio_actual")
        conn.execute("REFRESH MATERIALIZED VIEW mart.precio_generico")
    comercios, genericos, filas, desde, hasta = conn.execute(
        "SELECT count(DISTINCT establecimiento_id), count(DISTINCT producto_canonico_id), "
        "count(*), min(fecha), max(fecha) FROM mart.precio_generico"
    ).fetchone()
    print(f"  precios vigentes: {filas:,} ({comercios} comercios, {genericos} genéricos, "
          f"del {desde} al {hasta})")


def main() -> None:
    pasos = [*RECURSOS, "core", "catalogo", "mart"]
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--solo", nargs="+", choices=pasos, default=pasos)
    # La web solo usa los precios del último mes: alcanza con el archivo del año más nuevo.
    # Así la actualización automática (GitHub Actions) baja 1 GB en lugar de 3.
    parser.add_argument("--liviano", action="store_true",
                        help="cargar solo el archivo de precios más reciente")
    args = parser.parse_args()

    from pipelines.comun.db import conectar

    DESTINO.mkdir(parents=True, exist_ok=True)
    with conectar() as conn:
        # Siempre en el mismo orden: primero raw, después core
        for nombre in [p for p in pasos if p in args.solo]:
            print(f"{nombre}:")
            if nombre == "core":
                transformar(conn)
                continue
            if nombre == "catalogo":
                armar_catalogo(conn)
                continue
            if nombre == "mart":
                refrescar_mart(conn)
                continue
            recurso = RECURSOS[nombre]
            urls = recurso["urls"][-1:] if args.liviano else recurso["urls"]
            archivos = [DESTINO / url.rsplit("/", 1)[1] for url in urls]
            for url, archivo in zip(urls, archivos):
                descargar(url, archivo)
                validar_encabezado(archivo, recurso["encoding"], recurso["encabezado"])
            filas = cargar(conn, archivos, recurso["tabla"], recurso["opciones"])
            print(f"  cargadas {filas:,} filas")


if __name__ == "__main__":
    main()
