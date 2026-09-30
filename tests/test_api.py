"""Tests de la API contra la base real (necesitan el SIPC cargado).

Uso:
    docker compose run --rm pipelines pytest -v
"""

import pytest
from fastapi.testclient import TestClient

from api.main import app

SALTO = {"lat": -31.3858, "lon": -57.9549}


@pytest.fixture(scope="module")
def cliente():
    # "with" ejecuta el arranque de la API (abre el pool de conexiones) y el cierre
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def ids(cliente):
    """Nombre del genérico → su id, para armar canastas legibles."""
    return {g["nombre"]: g["producto_canonico_id"] for g in cliente.get("/genericos").json()}


def cotizar(cliente, ids, productos, **extra):
    items = [{"producto_canonico_id": ids[n], "cantidad": c} for n, c in productos]
    return cliente.post("/canasta/cotizar", json={"items": items, **SALTO, **extra})


# ─── Respuestas correctas ────────────────────────────────────────────────────

def test_salud(cliente):
    r = cliente.get("/salud")
    assert r.status_code == 200
    assert r.json()["estado"] == "ok"


def test_genericos_tienen_precio(cliente):
    genericos = cliente.get("/genericos").json()
    assert len(genericos) > 50
    assert all(g["comercios_con_precio"] > 0 for g in genericos)


def test_comercios_ordenados_por_distancia(cliente):
    comercios = cliente.get("/comercios", params={**SALTO, "radio_km": 3}).json()
    distancias = [c["distancia_km"] for c in comercios]
    assert distancias == sorted(distancias)
    assert all(d <= 3 for d in distancias)


def test_cotizacion_ordenada_por_cobertura_y_total(cliente, ids):
    r = cotizar(cliente, ids, [("Arroz blanco", 2), ("Huevos", 12), ("Carne picada", 1)])
    assert r.status_code == 200
    resultados = r.json()
    assert resultados
    claves = [(-x["cobertura"], x["total"]) for x in resultados]
    assert claves == sorted(claves)


def test_paquetes_no_se_fraccionan(cliente, ids):
    # 1 l de aceite viene en botellas de 900 cc: hay que comprar 2 botellas enteras
    r = cotizar(cliente, ids, [("Aceite de girasol", 1)])
    for comercio in r.json():
        (linea,) = comercio["detalle"]
        assert linea["unidades"] == int(linea["unidades"])
        assert linea["costo"] == pytest.approx(linea["unidades"] * linea["precio"])


def test_lo_suelto_es_proporcional(cliente, ids):
    r = cotizar(cliente, ids, [("Manzana", 1.5)])
    for comercio in r.json():
        (linea,) = comercio["detalle"]
        assert linea["unidades"] == pytest.approx(1.5)


def test_faltantes_y_cobertura_coinciden(cliente, ids):
    r = cotizar(cliente, ids, [("Arroz blanco", 1), ("Huevos", 6), ("Yerba mate", 1)])
    for x in r.json():
        assert x["productos_con_precio"] + len(x["faltantes"]) == x["productos_pedidos"]


def test_presupuesto(cliente, ids):
    r = cotizar(cliente, ids, [("Arroz blanco", 1)], presupuesto=1)
    assert all(not x["entra_en_presupuesto"] for x in r.json())


# ─── Pedidos inválidos: 422 antes de llegar a la base ────────────────────────

@pytest.mark.parametrize("cambio", [
    {"lat": -38.0},                                           # fuera de Uruguay
    {"items": []},                                            # canasta vacía
    {"items": [{"producto_canonico_id": 3, "cantidad": -1}]}, # cantidad negativa
    {"radio_km": 500},                                        # radio exagerado
])
def test_pedidos_invalidos(cliente, cambio):
    pedido = {"items": [{"producto_canonico_id": 3, "cantidad": 1}], **SALTO, **cambio}
    assert cliente.post("/canasta/cotizar", json=pedido).status_code == 422


def test_producto_inexistente(cliente):
    pedido = {"items": [{"producto_canonico_id": 999999, "cantidad": 1}], **SALTO}
    r = cliente.post("/canasta/cotizar", json=pedido)
    assert r.status_code == 422
    assert "999999" in r.json()["detail"]


def test_productos_repetidos(cliente, ids):
    r = cotizar(cliente, ids, [("Arroz blanco", 1), ("Arroz blanco", 2)])
    assert r.status_code == 422
