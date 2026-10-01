"""Exporta la capa mart a archivos JSON para la web estática (GitHub Pages).

Sin servidor no hay base de datos a la que preguntarle: la web descarga estos archivos y
cotiza la canasta en el navegador (ver web/src/lib/cotizar.ts, que repite la lógica de
mart.cotizar_canasta).

Destino: web/public/datos/
    base.json     fecha de los precios, ciudades, genéricos y comercios (lo que se muestra
                  al abrir la página)
    precios.json  precios vigentes, compactos: se descargan recién al cotizar

Los archivos salen siempre en el mismo orden y sin la hora de generación: si los datos no
cambiaron, los archivos quedan idénticos y la actualización automática no hace commit.

Uso:
    docker compose run --rm pipelines python -m pipelines.exportar.web_estatica
"""

import json
from pathlib import Path

from psycopg.rows import dict_row

DESTINO = Path("web/public/datos")

CIUDADES = """
    SELECT departamento, ciudad, comercios, round(lat::numeric, 5) AS lat, round(lon::numeric, 5) AS lon
    FROM mart.ciudad ORDER BY departamento, ciudad
"""

GENERICOS = """
    SELECT * FROM mart.generico WHERE comercios_con_precio > 0 ORDER BY categoria, nombre
"""

# Todos los comercios con ubicación: el mapa los muestra aunque no tengan precios
COMERCIOS = """
    SELECT id AS establecimiento_id, nombre, cadena, direccion, ciudad,
           round(ST_Y(ubicacion::geometry)::numeric, 6) AS lat,
           round(ST_X(ubicacion::geometry)::numeric, 6) AS lon
    FROM core.establecimiento
    WHERE ubicacion IS NOT NULL
    ORDER BY id
"""

# Cada producto del SIPC aparece una vez, con su genérico, nombre y tamaño
PRODUCTOS = """
    SELECT DISTINCT producto_fuente_id, producto_canonico_id, producto, tamano
    FROM mart.precio_generico
    ORDER BY producto_fuente_id
"""

# Cada precio es una fila corta: comercio, producto, precio y hace cuántos días se tomó
PRECIOS = """
    SELECT establecimiento_id, producto_fuente_id, precio,
           (SELECT max(fecha) FROM mart.precio_generico) - fecha AS dias
    FROM mart.precio_generico
    ORDER BY establecimiento_id, producto_fuente_id
"""


def numero(valor):
    """Los numeric de Postgres llegan como Decimal: se pasan a int o float para JSON."""
    return int(valor) if valor == valor.to_integral_value() else float(valor)


def escribir(nombre: str, datos) -> None:
    archivo = DESTINO / nombre
    # separators sin espacios: el archivo pesa menos
    texto = json.dumps(datos, ensure_ascii=False, separators=(",", ":"), default=numero)
    archivo.write_text(texto, encoding="utf-8")
    print(f"  {nombre}: {archivo.stat().st_size / 1e3:,.0f} KB")


def main() -> None:
    from pipelines.comun.db import conectar

    DESTINO.mkdir(parents=True, exist_ok=True)
    with conectar() as conn, conn.cursor(row_factory=dict_row) as cur:
        ultimo = cur.execute("SELECT max(fecha) AS f FROM mart.precio_generico").fetchone()["f"]
        escribir("base.json", {
            "ultimo_precio": ultimo.isoformat(),
            "ciudades": cur.execute(CIUDADES).fetchall(),
            "genericos": cur.execute(GENERICOS).fetchall(),
            "comercios": cur.execute(COMERCIOS).fetchall(),
        })

        productos = cur.execute(PRODUCTOS).fetchall()
        # Los precios nombran al producto por su posición en la lista, no por su id
        posicion = {p["producto_fuente_id"]: i for i, p in enumerate(productos)}
        precios = cur.execute(PRECIOS).fetchall()
        escribir("precios.json", {
            "ultimo_precio": ultimo.isoformat(),
            "productos": [[p["producto_canonico_id"], p["producto"], p["tamano"]] for p in productos],
            "precios": [
                [p["establecimiento_id"], posicion[p["producto_fuente_id"]], p["precio"], p["dias"]]
                for p in precios
            ],
        })


if __name__ == "__main__":
    main()
