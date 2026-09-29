"""Conexión a Postgres a partir de las variables del archivo .env."""

import os

import psycopg
from dotenv import load_dotenv

load_dotenv()


def conectar() -> psycopg.Connection:
    return psycopg.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5433")),
        dbname=os.getenv("POSTGRES_DB", "precios"),
        user=os.getenv("POSTGRES_USER", "precios"),
        password=os.environ["POSTGRES_PASSWORD"],
    )
