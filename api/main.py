"""API de Canasta UY: expone la capa mart para la web.

Documentación interactiva (la genera FastAPI a partir de este código): /docs

Uso local:
    docker compose up -d api        → http://localhost:8000/docs
"""

from contextlib import asynccontextmanager
from datetime import date

from fastapi import FastAPI, HTTPException, Query
from psycopg.types.json import Jsonb
from pydantic import BaseModel, Field

from api.db import crear_pool

# Rectángulo que contiene a Uruguay: se rechazan puntos fuera del país
LAT_MIN, LAT_MAX = -35.2, -30.0
LON_MIN, LON_MAX = -58.6, -53.0

pool = None


@asynccontextmanager
async def ciclo_de_vida(app: FastAPI):
    # El pool se abre una vez al arrancar la API y se cierra al apagarla
    global pool
    pool = crear_pool()
    yield
    pool.close()


app = FastAPI(
    title="Canasta UY",
    description="Compras al menor costo en Uruguay, con precios del SIPC.",
    version="0.1.0",
    lifespan=ciclo_de_vida,
)


def consultar(sql: str, params: dict | tuple | None = None) -> list[dict]:
    with pool.connection() as conn:
        return conn.execute(sql, params).fetchall()


# ─── Modelos: qué entra y qué sale de cada endpoint ──────────────────────────
# Pydantic valida los datos: si algo no cumple (una cantidad negativa, un punto fuera de
# Uruguay), FastAPI responde 422 con el detalle, sin llegar a la base.

class Ciudad(BaseModel):
    departamento: str
    ciudad: str
    comercios: int
    lat: float
    lon: float


class Generico(BaseModel):
    producto_canonico_id: int
    nombre: str
    categoria: str
    unidad_base: str = Field(description="En qué se pide la cantidad: kg, l, unidad o m")
    se_vende_suelto: bool
    comercios_con_precio: int


class Comercio(BaseModel):
    establecimiento_id: int
    nombre: str
    cadena: str | None
    direccion: str | None
    ciudad: str | None
    lat: float
    lon: float
    distancia_km: float


class ItemCanasta(BaseModel):
    producto_canonico_id: int
    cantidad: float = Field(gt=0, le=1000, description="En la unidad base del genérico")


class PedidoCanasta(BaseModel):
    items: list[ItemCanasta] = Field(min_length=1, max_length=50)
    lat: float = Field(ge=LAT_MIN, le=LAT_MAX)
    lon: float = Field(ge=LON_MIN, le=LON_MAX)
    radio_km: float = Field(default=5, gt=0, le=50)
    presupuesto: float | None = Field(default=None, gt=0)
    limite: int = Field(default=20, ge=1, le=100, description="Cuántos comercios devolver")


class LineaCanasta(BaseModel):
    generico: str
    producto: str
    cantidad: float
    unidades: float = Field(description="Paquetes a comprar, o kilos si se vende suelto")
    precio: float
    costo: float


class ResultadoComercio(BaseModel):
    establecimiento_id: int
    comercio: str
    cadena: str | None
    direccion: str | None
    ciudad: str | None
    distancia_km: float
    productos_pedidos: int
    productos_con_precio: int
    cobertura: float = Field(description="1 = tiene toda la canasta")
    total: float
    entra_en_presupuesto: bool
    faltantes: list[str]
    fecha_precios: date = Field(description="El precio más viejo usado en la cotización")
    detalle: list[LineaCanasta]


# ─── Endpoints ───────────────────────────────────────────────────────────────

@app.get("/salud")
def salud() -> dict:
    """Verifica que la API y la base respondan."""
    fila = consultar("SELECT max(fecha) AS ultimo_precio FROM mart.precio_generico")[0]
    return {"estado": "ok", "ultimo_precio": fila["ultimo_precio"]}


@app.get("/ciudades", response_model=list[Ciudad])
def ciudades() -> list[dict]:
    """Departamentos y ciudades con comercios, con el centro para ubicar el mapa."""
    return consultar("SELECT * FROM mart.ciudad ORDER BY departamento, ciudad")


@app.get("/genericos", response_model=list[Generico])
def genericos() -> list[dict]:
    """Productos genéricos que se pueden pedir (los que tienen precios vigentes)."""
    return consultar(
        "SELECT * FROM mart.generico WHERE comercios_con_precio > 0 ORDER BY categoria, nombre"
    )


@app.get("/comercios", response_model=list[Comercio])
def comercios(
    lat: float = Query(ge=LAT_MIN, le=LAT_MAX),
    lon: float = Query(ge=LON_MIN, le=LON_MAX),
    radio_km: float = Query(default=5, gt=0, le=50),
) -> list[dict]:
    """Comercios a menos de radio_km del punto, del más cercano al más lejano."""
    return consultar(
        """
        SELECT id AS establecimiento_id, nombre, cadena, direccion, ciudad,
               ST_Y(ubicacion::geometry) AS lat, ST_X(ubicacion::geometry) AS lon,
               round((ST_Distance(ubicacion, punto) / 1000)::numeric, 2) AS distancia_km
        FROM core.establecimiento,
             LATERAL (SELECT ST_MakePoint(%(lon)s, %(lat)s)::geography AS punto) p
        WHERE ST_DWithin(ubicacion, punto, %(radio)s * 1000)
        ORDER BY ubicacion <-> punto
        """,
        {"lat": lat, "lon": lon, "radio": radio_km},
    )


@app.post("/canasta/cotizar", response_model=list[ResultadoComercio])
def cotizar(pedido: PedidoCanasta) -> list[dict]:
    """Cotiza la canasta en los comercios cercanos: primero los que tienen todo, del más barato al más caro."""
    ids = [item.producto_canonico_id for item in pedido.items]
    if len(ids) != len(set(ids)):
        raise HTTPException(422, "Hay productos repetidos en la canasta: sumá las cantidades.")

    existentes = {
        f["producto_canonico_id"]
        for f in consultar(
            "SELECT producto_canonico_id FROM mart.generico WHERE producto_canonico_id = ANY(%s)",
            (ids,),
        )
    }
    if desconocidos := sorted(set(ids) - existentes):
        raise HTTPException(422, f"Productos que no existen: {desconocidos}")

    return consultar(
        """
        SELECT * FROM mart.cotizar_canasta(%(canasta)s, %(lat)s, %(lon)s,
                                           %(radio)s::numeric, %(presupuesto)s::numeric)
        LIMIT %(limite)s
        """,
        {
            # Los parámetros van separados del SQL: psycopg los envía aparte, así un valor
            # nunca puede "inyectar" código SQL
            "canasta": Jsonb([item.model_dump() for item in pedido.items]),
            "lat": pedido.lat,
            "lon": pedido.lon,
            "radio": pedido.radio_km,
            "presupuesto": pedido.presupuesto,
            "limite": pedido.limite,
        },
    )
