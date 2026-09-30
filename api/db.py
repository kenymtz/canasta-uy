"""Pool de conexiones de la API a Postgres, en modo solo lectura."""

import os

from dotenv import load_dotenv
from psycopg.conninfo import make_conninfo
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

load_dotenv()


def crear_pool() -> ConnectionPool:
    # Un pool mantiene algunas conexiones abiertas y las reparte entre los pedidos: abrir
    # una conexión nueva por pedido tarda más que la consulta misma.
    conninfo = make_conninfo(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=os.getenv("POSTGRES_PORT", "5433"),
        dbname=os.getenv("POSTGRES_DB", "precios"),
        user=os.getenv("POSTGRES_USER", "precios"),
        password=os.environ["POSTGRES_PASSWORD"],
        # La API solo lee: aunque tuviera un error, Postgres rechaza cualquier escritura
        options="-c default_transaction_read_only=on",
    )
    return ConnectionPool(
        conninfo,
        min_size=1,
        max_size=5,
        kwargs={"row_factory": dict_row},  # cada fila llega como diccionario
        open=True,
    )
