"""Descarga los archivos del SIPC (Uruguay), los carga en raw y los pasa a core.

Fuente: catálogo de datos abiertos, dataset "Sistema de Información de Precios al
Consumidor - 2025" (Defensa del Consumidor). Hay un archivo de precios por año, que se
actualiza cada trimestre, y dos catálogos: productos y comercios.
Destino: raw.sipc_* (tal cual vienen) y después core.establecimiento,
core.producto_fuente y core.precio (limpios; ver sql/transform/sipc_core.sql).

Cada paso corre dentro de una transacción: si algo falla, las tablas quedan como estaban,
y volver a correrlo no duplica nada.
Solo se descarga un archivo si cambió de tamaño respecto de la copia local.

Uso:
    python -m pipelines.fuentes.sipc
    python -m pipelines.fuentes.sipc --solo productos establecimientos
    python -m pipelines.fuentes.sipc --solo core
"""

import argparse
from pathlib import Path

import requests

DESTINO = Path("data/raw/sipc")
TRANSFORMACION = Path("sql/transform/sipc_core.sql")
DATASET = "https://catalogodatos.gub.uy/dataset/35d8f45e-2aa7-48b5-98dd-f973b05cf8ba/resource"

# El encabezado esperado funciona como contrato: si la fuente cambia columnas u orden,
# el pipeline se detiene en lugar de cargar datos corridos de lugar.
RECURSOS = {
    "productos": {
        "url": f"{DATASET}/ed042b97-12ce-46ff-a169-b2594337a6e4/download/productos.csv",
        "encoding": "latin-1",
        "encabezado": "id.producto;producto;marca;especificacion;nombre",
        "tabla": "raw.sipc_productos",
        "opciones": "FORMAT csv, DELIMITER ';', HEADER true, ENCODING 'LATIN1'",
    },
    "establecimientos": {
        "url": f"{DATASET}/5fbdd7e8-97fa-44db-b978-4381670c8933/download/establecimiento.csv",
        "encoding": "latin-1",
        "encabezado": (
            "id.establecimientos;razon.social;nombre.sucursal;direccion;ccz;barrio;cajas;"
            "cadena;long;lat;ciudad;depto;id.depto;localidad;superficie (m2)"
        ),
        "tabla": "raw.sipc_establecimientos",
        "opciones": "FORMAT csv, DELIMITER ';', HEADER true, ENCODING 'LATIN1'",
    },
    "precios": {
        "url": f"{DATASET}/36c62bab-b7e4-4c9e-ad9b-4c1182090a22/download/precios_2025.csv",
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


def cargar(conn, archivo: Path, tabla: str, opciones: str) -> int:
    """Reemplaza el contenido de la tabla con el archivo. Devuelve las filas cargadas."""
    with conn.transaction(), conn.cursor() as cur:
        cur.execute(f"TRUNCATE {tabla}")
        copy_sql = f"COPY {tabla} FROM STDIN WITH ({opciones})"
        with cur.copy(copy_sql) as copy, open(archivo, "rb") as f:
            while bloque := f.read(1 << 20):
                copy.write(bloque)
        filas = cur.rowcount
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


def main() -> None:
    pasos = [*RECURSOS, "core"]
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--solo", nargs="+", choices=pasos, default=pasos)
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
            recurso = RECURSOS[nombre]
            archivo = DESTINO / recurso["url"].rsplit("/", 1)[1]
            descargar(recurso["url"], archivo)
            validar_encabezado(archivo, recurso["encoding"], recurso["encabezado"])
            filas = cargar(conn, archivo, recurso["tabla"], recurso["opciones"])
            print(f"  cargadas {filas:,} filas")


if __name__ == "__main__":
    main()
