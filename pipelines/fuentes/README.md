# Ingesta por fuente

Un módulo por fuente de datos. Cada uno baja los datos crudos a `data/raw/<fuente>/`,
los carga en `raw.*` y después los normaliza hacia `core.*`.

| Módulo | Fuente | Estado |
|---|---|---|
| `sipc.py` | Sistema de Información de Precios al Consumidor (Uruguay) | `raw` y `core` listos |

Antes de escribir cada módulo, explorá un archivo real de la fuente para conocer sus
columnas y diseñar la tabla `raw.*` correspondiente. Las fuentes evaluadas están en
[`docs/FUENTES.md`](../../docs/FUENTES.md).
