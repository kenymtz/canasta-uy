"""Avisa si en el catálogo de datos abiertos apareció un SIPC de un año que el pipeline no carga.

Cada año el SIPC se publica como un dataset nuevo, con otra dirección: hay que agregarla a
mano en RECURSOS (pipelines/fuentes/sipc.py). La actualización mensual corre este script y, si
encuentra un año nuevo, abre un aviso en GitHub.

Solo usa la biblioteca estándar (corre fuera de Docker, en la máquina de GitHub).

Uso:
    python3 pipelines/fuentes/sipc_anio_nuevo.py
Imprime el año nuevo (por ejemplo 2027) o nada, y lo deja en GITHUB_OUTPUT como anio_nuevo.
"""

import json
import os
import re
import urllib.request
from pathlib import Path

CATALOGO = "https://catalogodatos.gub.uy/api/3/action/package_search?q=%22Precios%20al%20Consumidor%22&rows=50"
TITULO = re.compile(r"Sistema de Informaci.n de Precios al Consumidor\s*-\s*(\d{4})", re.IGNORECASE)
PIPELINE = Path(__file__).with_name("sipc.py")


def anios_publicados() -> set[int]:
    with urllib.request.urlopen(CATALOGO, timeout=30) as respuesta:
        datasets = json.load(respuesta)["result"]["results"]
    return {int(m.group(1)) for d in datasets if (m := TITULO.search(d["title"]))}


def anios_cargados() -> set[int]:
    # Las constantes SIPC_2025, SIPC_2026... de sipc.py
    return {int(a) for a in re.findall(r"^SIPC_(\d{4})\s*=", PIPELINE.read_text(encoding="utf-8"), re.MULTILINE)}


def main() -> None:
    cargados = anios_cargados()
    nuevos = sorted(a for a in anios_publicados() if a > max(cargados))
    print(f"Años en el pipeline: {sorted(cargados)}; nuevos en el catálogo: {nuevos or 'ninguno'}")
    if nuevos and (salida := os.environ.get("GITHUB_OUTPUT")):
        with open(salida, "a", encoding="utf-8") as f:
            f.write(f"anio_nuevo={nuevos[-1]}\n")


if __name__ == "__main__":
    main()
