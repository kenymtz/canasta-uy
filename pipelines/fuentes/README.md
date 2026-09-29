# Ingesta por fuente

Un módulo por fuente de datos. Cada uno baja los datos crudos a `data/raw/<fuente>/`,
los carga en `raw.*` y después los normaliza hacia `core.*`.

| Módulo (pendiente) | Fuente | País |
|---|---|---|
| `sipc.py` | Sistema de Información de Precios al Consumidor | 🇺🇾 |
| `sepa.py` | Precios Claros – Base SEPA | 🇦🇷 |
| `nfce_rs.py` | NFC-e a partir del QR del ticket (SEFAZ-RS) | 🇧🇷 |

Antes de escribir cada módulo, explorá un archivo real de la fuente en `notebooks/`
para conocer sus columnas y diseñar la tabla `raw.*` correspondiente.
