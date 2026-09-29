"""Descarga los archivos del SIPC (Uruguay) y los carga en la capa raw.

Fuente: catálogo de datos abiertos, dataset "Sistema de Información de Precios al
Consumidor - 2025" (Defensa del Consumidor). Hay un archivo de precios por año, que se
actualiza cada trimestre, y dos catálogos: productos y comercios.
Destino: raw.sipc_productos, raw.sipc_establecimientos y raw.sipc_precios.

Cada archivo se carga completo dentro de una transacción (TRUNCATE + COPY): si algo
falla, la tabla queda como estaba, y volver a correrlo no duplica nada.
Solo se descarga un archivo si cambió de tamaño respecto de la copia local.

Uso:
    python -m pipelines.fuentes.sipc
    python -m pipelines.fuentes.sipc --solo productos establecimientos
"""

import argparse
from pathlib import Path

import requests

DESTINO = Path("data/raw/sipc")
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


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--solo", nargs="+", choices=RECURSOS, default=list(RECURSOS))
    args = parser.parse_args()

    from pipelines.comun.db import conectar

    DESTINO.mkdir(parents=True, exist_ok=True)
    with conectar() as conn:
        for nombre in args.solo:
            recurso = RECURSOS[nombre]
            archivo = DESTINO / recurso["url"].rsplit("/", 1)[1]
            print(f"{nombre}:")
            descargar(recurso["url"], archivo)
            validar_encabezado(archivo, recurso["encoding"], recurso["encabezado"])
            filas = cargar(conn, archivo, recurso["tabla"], recurso["opciones"])
            print(f"  cargadas {filas:,} filas")


if __name__ == "__main__":
    main()
