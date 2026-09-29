# Contexto del proyecto (traspaso)

Documento para retomar el proyecto en una conversación nueva.
Última actualización: 29/09/2026.

## Quién y para qué

- Autor: Augusto, estudiante de Licenciatura en Ingeniería de Datos e IA (UTEC, Uruguay).
- Objetivo: un proyecto de **portafolio para GitHub** que muestre ingeniería de datos
  (pipelines, modelado, calidad, orquestación) e IA aplicada (visión, embeddings, evaluación).

## Cómo evolucionó la idea

1. **Idea original:** una automatización que conozca tu saldo disponible, compare
   precios de supermercados cercanos y te diga dónde conviene comprar. Además, mandarle
   la foto del ticket para extraer los datos y comparar la compra con la anterior.
2. **Fuente de datos para Uruguay:** se encontró el **SIPC** (Sistema de Información de
   Precios al Consumidor, MEF): precios diarios y geolocalizados de ~219 presentaciones en
   ~680+ comercios, en datos abiertos. Resuelve legalmente la base de precios.
3. **Ampliación a la frontera:** el foco pasó a las ciudades de frontera seca o con
   puente, donde la gente cruza a comprar y decide "a ojo".

## Idea final

**"Precios de Frontera": ¿conviene cruzar a comprar?** Un comparador de precios entre
Uruguay y sus ciudades vecinas de Brasil y Argentina, sobre datos abiertos oficiales,
con extracción de tickets por IA y matching de productos entre idiomas.

Pares de ciudades:

| Uruguay | Vecina | Tipo |
|---|---|---|
| Rivera | Santana do Livramento (BR) | seca |
| Chuy | Chuí (BR) | seca |
| Aceguá | Aceguá (BR) | seca |
| Artigas | Quaraí (BR) | puente |
| Río Branco | Jaguarão (BR) | puente |
| Bella Unión | Barra do Quaraí (BR) | puente |
| Salto | Concordia (AR) | represa |
| Paysandú | Colón (AR) | puente |
| Fray Bentos | Gualeguaychú (AR) | puente |

### Funcionalidades

- **Recomendador:** mandás tu lista, tu ubicación y tu presupuesto (por WhatsApp) →
  te dice en qué local conviene comprar y cuánto ahorrás, considerando moneda, cambio,
  distancia/traslado y franquicia aduanera.
- **Tickets:** foto (UY/AR, extracción con Gemini visión) o **QR de la NFC-e** (BR, datos
  estructurados sin OCR) → se guardan los ítems y se comparan con la compra anterior y
  con los precios de otros locales.
- **Dashboard:** "Índice de precios de frontera", la misma canasta de cada lado, mes a mes.

### Fuentes de datos

| Fuente | País | Notas |
|---|---|---|
| SIPC (precios.uy / catalogodatos.gub.uy) | UY | Oficial, diaria, geolocalizada |
| Precios Claros – Base SEPA (datos.produccion.gob.ar) | AR | Oficial, ~12 M precios/día, grandes cadenas, CC BY 4.0 |
| NFC-e por QR del ticket (SEFAZ-RS) | BR | No hay base abierta; los tickets alimentan la base (crowdsourcing) |
| PTAX – Banco Central do Brasil (API Olinda) | BR | Tipo de cambio oficial, JSON, sin autenticación |
| BCU / BCRA | UY / AR | Tipo de cambio oficial (pipelines pendientes) |

### Decisiones tomadas (y por qué)

- **No conectarse al banco:** en Uruguay no hay open banking con API pública; hacer
  scraping del home banking es inseguro y una bandera roja en un repo público.
  El saldo se ingresa a mano ("tengo $4500") o se estima a partir de los mails de aviso del banco.
- **Sin scraping** de webs ni de apps sin datos abiertos. La app **Menor Preço – Nota
  Gaúcha** (RS) tiene los datos, pero no tiene API pública: no se usa.
- **Dos tipos de cambio:** 'oficial' (automático) y 'frontera' (casas de cambio, cargado
  a mano); se muestra cuál se usó.
- **Franquicias aduaneras** como parámetros con fuente y vigencia en una tabla, nunca
  montos fijos en el código, con aviso de "verificar con Aduanas".
- **Cobertura:** si faltan productos de un lado, avisarlo en lugar de comparar mal.
- **Desafío técnico central:** **matching multilingüe** de productos
  ("Leche entera Conaprole 1 L" ↔ "Leite integral Piracanjuba 1L" → canónico
  "leche entera, 1 l"), por EAN → reglas/pg_trgm → embeddings (pgvector), medido con
  precisión y recall sobre un set etiquetado.
- **Orden de construcción:** UY + AR primero (fuentes abiertas completas; Salto–Concordia
  ya permite una comparación entre países), Brasil después vía NFC-e.

## Qué está hecho

Repo local en `C:\Users\valla\projects\precios-frontera` (rama `main`), publicado en
GitHub como repositorio público: https://github.com/kenymtz/precios-frontera

- `docker-compose.yml`: Postgres 17 + PostGIS + pgvector (puerto **5433**, solo en
  127.0.0.1), Metabase (puerto **3000**), n8n opcional con `--profile n8n` (puerto **5679**),
  servicio `pipelines` (`docker compose run --rm pipelines python -m ...`) y Jupyter Lab
  con `--profile jupyter` (puerto **8888**).
- `docker/postgres/Dockerfile`: imagen postgis/postgis:17-3.5 + postgresql-17-pgvector.
- `docker/python/Dockerfile`: python:3.11-slim + `requirements.txt`; el repo se monta en `/app`.
- `sql/init/`:
  - `00_extensiones.sql`: postgis, vector, pg_trgm, unaccent; base `metabase`; schemas `raw`, `core`, `mart`.
  - `01_esquema.sql`: pais, par_frontera, fuente, establecimiento (geography), producto_canonico
    (embedding vector(768) + HNSW), producto_fuente, match_producto, precio (PK idempotente),
    tipo_cambio (oficial/frontera), ticket, ticket_item, franquicia_aduanera.
  - `02_datos_base.sql`: países, 9 pares de frontera, fuentes.
  - `03_vistas.sql`: función `core.a_unidad_base` y vista `mart.precio_comparable`
    (precio en USD por kg/l/unidad con el último cambio oficial).
- `pipelines/cambio/bcb_ptax.py`: **primer pipeline funcionando** (probado con la API real
  en `--dry-run`; por ejemplo, 25/09/2026 1 USD = 5,1991 BRL). Carga idempotente en `core.tipo_cambio`.
- `pipelines/comun/db.py`, `requirements.txt`, `.env.example`, `.gitignore`, `README.md`
  (con diagrama mermaid y hoja de ruta), carpetas `notebooks/`, `eval/`, `n8n/workflows/`, `data/`.

### Validado (29/09/2026)

- `docker compose config` válido, con y sin perfiles; falla con un mensaje claro si falta `POSTGRES_PASSWORD`.
- La imagen de Postgres compila (pgvector 0.8.6, PostGIS 3.5.2, pg_trgm 1.6, unaccent 1.1).
- Los 4 scripts de `sql/init/` corren sin errores: 12 tablas en `core`, la vista en `mart`,
  3 países, 9 pares de frontera, 5 fuentes y la base `metabase`.
- Prueba de humo (en una transacción con rollback): `mart.precio_comparable` pasa UYU y ARS
  a USD por unidad base; `ST_Distance` Salto–Concordia ≈ 5,8 km; `pg_trgm` + `unaccent`;
  el índice HNSW se usa en `ORDER BY embedding <=> ...`; el upsert de `tipo_cambio` es idempotente.
  `core.a_unidad_base` devuelve NULL con unidades desconocidas (no compara mal).
- Carga real de PTAX: 21 días hábiles (31/08 a 29/09/2026) en `core.tipo_cambio`; al
  volver a correrla no se duplican filas.
- Metabase responde (`/api/health` 200) y Jupyter Lab arranca con el perfil `jupyter`.

### Python corre en Docker, no en Windows

En esta PC está activado **Smart App Control** (Windows 11) y bloquea las DLL sin firma de
`psycopg[binary]` y `pandas` ("Una directiva de Control de aplicaciones bloqueó este archivo").
Decisión: no tocar la configuración de seguridad y correr los pipelines y los notebooks en
el contenedor `pipelines` / `jupyter`. Además, así es igual que en el futuro VPS.
Después de cambiar `requirements.txt` hay que reconstruir la imagen: `docker compose build pipelines`.

## Próximos pasos

1. Explorar un CSV real del SIPC en `notebooks/` → diseñar `raw.sipc_*` → `pipelines/fuentes/sipc.py`
   (carga inicial + incremental diaria + controles de calidad).
2. Lo mismo con SEPA (Argentina).
3. Pipelines de cambio BCU y BCRA.
4. Catálogo canónico y matching (reglas → embeddings) + set de evaluación.
5. NFC-e por QR (Brasil), tickets por foto, recomendador con PostGIS, bot de WhatsApp,
   dashboard en Metabase.

## Entorno disponible

- Windows 11 (con Smart App Control), Docker Desktop, Python 3.11 (el de Windows no
  puede cargar psycopg ni pandas: ver arriba), git, `gh` con la cuenta `kenymtz`.
- Ya existe un **n8n** propio (contenedor `n8n`, volumen `n8n_data`, puerto 5678) publicado
  en `https://n8n-augusto.taile8147c.ts.net` con Tailscale Funnel. Tiene un bot de WhatsApp
  (número de prueba de Meta, audio con Gemini) y credenciales de Gemini, Gmail, Calendar y Sheets.
  Para conectarlo a la base del proyecto: host `host.docker.internal`, puerto `5433`.
  No mezclar ese contenedor con el compose del proyecto.
- Modelos de Gemini: `gemini-2.5-flash` ya no está disponible para cuentas nuevas; usar
  `gemini-3.8-flash`. Evitar los `-preview` en producción (dan 503 por alta demanda).
- A futuro, para usarlo con otras personas: un VPS barato (Hetzner / Contabo / Hostinger)
  en lugar de la PC personal.
