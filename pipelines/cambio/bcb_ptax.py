"""Carga la cotización oficial del dólar en Brasil (PTAX, Banco Central do Brasil).

Fuente: API Olinda del BCB (datos abiertos, sin autenticación).
Destino: core.tipo_cambio con moneda='BRL', tipo='oficial'.
La carga es idempotente: si el día ya existe, se actualiza.

Uso:
    python -m pipelines.cambio.bcb_ptax --desde 2026-09-01 --hasta 2026-09-25
    python -m pipelines.cambio.bcb_ptax --dias 7 --dry-run
"""

import argparse
import sys
from datetime import date, datetime, timedelta

import requests

# La consola de Windows usa cp1252 por defecto: forzamos UTF-8 para las tildes
sys.stdout.reconfigure(encoding="utf-8")

URL = (
    "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/"
    "CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)"
)

UPSERT = """
    INSERT INTO core.tipo_cambio (fecha, moneda, tipo, por_usd, fuente)
    VALUES (%s, 'BRL', 'oficial', %s, 'bcb_ptax')
    ON CONFLICT (fecha, moneda, tipo)
    DO UPDATE SET por_usd = EXCLUDED.por_usd, fuente = EXCLUDED.fuente
"""


def descargar(desde: date, hasta: date) -> dict[date, float]:
    """Devuelve {fecha: reales por dólar} usando la cotización de venta."""
    params = {
        "@dataInicial": f"'{desde:%m-%d-%Y}'",
        "@dataFinalCotacao": f"'{hasta:%m-%d-%Y}'",
        "$format": "json",
    }
    resp = requests.get(URL, params=params, timeout=30)
    resp.raise_for_status()

    cotizaciones: dict[date, float] = {}
    # Si hay más de un boletín en el día, queda el último (vienen en orden cronológico)
    for fila in resp.json()["value"]:
        fecha = datetime.fromisoformat(fila["dataHoraCotacao"]).date()
        cotizaciones[fecha] = fila["cotacaoVenda"]
    return cotizaciones


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--desde", type=date.fromisoformat)
    parser.add_argument("--hasta", type=date.fromisoformat, default=date.today())
    parser.add_argument("--dias", type=int, default=7, help="si no se indica --desde")
    parser.add_argument("--dry-run", action="store_true", help="solo mostrar, no guardar")
    args = parser.parse_args()

    desde = args.desde or args.hasta - timedelta(days=args.dias)
    cotizaciones = descargar(desde, args.hasta)
    print(f"PTAX {desde} a {args.hasta}: {len(cotizaciones)} días hábiles")

    if args.dry_run:
        for fecha, valor in sorted(cotizaciones.items()):
            print(f"  {fecha}  1 USD = {valor:.4f} BRL")
        return

    from pipelines.comun.db import conectar

    with conectar() as conn, conn.cursor() as cur:
        cur.executemany(UPSERT, sorted(cotizaciones.items()))
    print(f"Guardadas {len(cotizaciones)} cotizaciones en core.tipo_cambio")


if __name__ == "__main__":
    main()
