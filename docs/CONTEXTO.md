# Contexto del proyecto (traspaso)

Documento para retomar el proyecto en una conversación nueva.
Última actualización: 30/09/2026.

## ⭐ Objetivo actual (redefinido por Augusto el 30/09/2026)

**Una web (adaptable al celular) para hacer las compras al menor costo, solo en Uruguay.**

1. El usuario pone su **presupuesto**, elige en un **mapa interactivo** su departamento y
   ciudad, y arma su canasta con **productos genéricos, sin marca, por categoría**
   ("aceite de girasol", "arroz").
2. La web le muestra **los comercios más convenientes** para esa canasta.
3. Puede **subir su ticket** (QR o foto) y ver **qué tan buena fue su compra** comparada con
   la anterior. Los datos se guardan **por usuario**.

Decisiones:
- **Solo Uruguay.** Argentina y Brasil quedan fuera: a Augusto le preocupa que el proyecto
  parezca incentivar el contrabando. Lo ya hecho de PTAX y de SEPA (ver "Hallazgos de SEPA")
  queda documentado pero no se sigue.
- **Web y no app nativa ni bot:** para el portafolio, un link que se abre con un clic pesa
  más; muestra el recorrido completo pipelines → base → API → interfaz. Stack propuesto:
  FastAPI + Leaflet/OpenStreetMap.
- El campo `producto` del SIPC ("Aceite de girasol") ya es la categoría genérica sin marca.
- Limitación a mostrar en la web: los precios del SIPC llegan al 31/12/2025.
- Tickets en Uruguay: son **CFE** de la DGI (no NFC-e, que es de Brasil). Falta investigar si
  el QR permite obtener los ítems o solo el total; si no, foto + extracción con IA.

Limpieza del 30/09/2026: se borraron los archivos de SEPA (1,7 GB), las cotizaciones PTAX
de la base y el espacio muerto de `core.precio` (la base pasó de 9 a 6 GB). Todos los enlaces
de las fuentes, usadas y descartadas, están en [`FUENTES.md`](FUENTES.md).

Las secciones siguientes cuentan la idea anterior ("Precios de Frontera"); la
infraestructura y el SIPC siguen valiendo, la parte de frontera no.

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

## Idea anterior (reemplazada el 30/09/2026)

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
| SIPC (precios.uy / catalogodatos.gub.uy) | UY | Oficial, geolocalizada. Precios diarios, pero el catálogo abierto publica un archivo por año que se actualiza cada trimestre (último dato: 31/12/2025) |
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
GitHub como repositorio público: https://github.com/kenymtz/canasta-uy (renombrado el
30/09/2026; antes `precios-frontera`, los links viejos redirigen). La carpeta local, el proyecto
de Docker Compose (`name: precios-frontera`) y el volumen `pf_pgdata` conservan el nombre viejo:
cambiar el `name` del compose crearía un volumen nuevo y vacío.

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
  - `04_raw_sipc.sql`: `raw.sipc_productos`, `raw.sipc_establecimientos` y `raw.sipc_precios`,
    con las columnas en el orden de cada CSV (COPY asigna por posición). Se aplicó a mano
    sobre la base existente (los scripts de init solo corren con el volumen vacío).
- `pipelines/fuentes/sipc.py`: baja los 3 CSV del SIPC a `data/raw/sipc/` (solo si cambió el
  tamaño) y los carga en raw con TRUNCATE + COPY en una transacción (idempotente). Valida el
  encabezado de cada archivo como contrato. Precios: 26.951.118 filas en ~1,5 min (~3 GB en la base).
  El paso `core` ejecuta `sql/transform/sipc_core.sql` en una transacción (~4 min) e imprime un
  reporte de calidad.
- `sql/transform/sipc_core.sql`: raw → core. Comercios (upsert; coordenadas corregidas a
  geography), productos (upsert; cantidad y unidad extraídas de `especificacion` con una
  expresión regular) y precios (se reemplaza el período del archivo; DISTINCT ON elimina
  duplicados quedándose con el último envío del día). Resultado: 852 comercios (4 sin
  ubicación), 379 productos (12 sin cantidad) y 26.846.628 precios (−657 huérfanos,
  −103.833 duplicados).
- Cambios de esquema en core (también aplicados con ALTER en la base existente):
  `producto_fuente.tipo` (tipo sin marca según la fuente, para el matching) y
  `precio.es_oferta` (13 % de los precios del SIPC son ofertas).
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
- Metabase configurado: conexión "Precios de Frontera" (host `postgres`, puerto `5432`,
  schemas `core` y `mart`, acciones de modelo apagadas). Su configuración vive en la base
  `metabase` del volumen `pf_pgdata`: `docker compose down -v` la borra junto con los datos.

### Python corre en Docker, no en Windows

En esta PC está activado **Smart App Control** (Windows 11) y bloquea las DLL sin firma de
`psycopg[binary]` y `pandas` ("Una directiva de Control de aplicaciones bloqueó este archivo").
Decisión: no tocar la configuración de seguridad y correr los pipelines y los notebooks en
el contenedor `pipelines` / `jupyter`. Además, así es igual que en el futuro VPS.
Después de cambiar `requirements.txt` hay que reconstruir la imagen: `docker compose build pipelines`.

### Hallazgos del SIPC (29/09/2026)

Formato de los archivos (exportados desde R, por eso los nombres tipo `id.producto`):
- `productos.csv` y `establecimiento.csv`: separador `;`, encoding **Latin-1**, coma decimal.
- `precios_2025.csv`: separador `,`, ASCII, punto decimal, nulos como `"\N"` entre comillas
  (requiere `FORCE_NULL`). Los 26 ids múltiplos de un millón vienen en notación científica
  (`1.75e+08` = 175000000): por eso `id_precio_diario` es `numeric` en raw.

Calidad de datos (a resolver al pasar a core):
- **Latitud y longitud cruzadas** en 846 de 849 comercios con coordenadas: la columna `long`
  trae la latitud. Además 3 sin coordenadas, 2 sin el signo menos (Ta-Ta Mercado Agrícola,
  Supermercado Atlantic) y 1 geocodificado en Ezeiza (San Roque Aeropuerto, Ciudad de la Costa).
- **Duplicados** de (fecha, comercio, producto): 103.765 combinaciones (0,8 % de las filas),
  hasta 3 repeticiones. 60 % son copias idénticas, 37 % el mismo precio reenviado a otra hora
  y 3,5 % (3.641) tienen **precios distintos** el mismo día. Regla aplicada en core:
  quedarse con la última `declaracion` (y ante empate, el mayor `id_precio_diario`).
- 2 comercios (ids 1023 y 1024) con precios que no están en el catálogo: solo informan del
  29 al 31/12/2025 y el catálogo de comercios es de noviembre, así que son comercios nuevos.
  Sus 657 precios se descartan en core hasta que se actualice el catálogo. Ningún producto huérfano.
- Marcas: 74 vacías y variantes de "sin marca" ("Con Hueso - Sin Marca") → NULL en core.
  Cadena "Sin Cadena" → NULL.
- 81.149 precios con 3 decimales: se redondean al centésimo en core.
- `publico` y `feria_id` vienen vacías en todo 2025: no se pasan a core.
- Catálogo: 379 productos y 852 comercios; con precios en 2025: 279 productos y 716 comercios.
- `especificacion` es texto ("Envase 900 cc"): la cantidad y la unidad se extraen en core.

Cobertura en la frontera (comercios con precios en 2025): Salto 14, Paysandú 9, Rivera 6,
Fray Bentos 5, Artigas 2, Río Branco 2, Chuy 1; **Bella Unión y Aceguá: 0** (solo se podrán
cubrir con tickets).

Otras fuentes evaluadas:
- precios.uy / app PreciosGub muestran precios actuales; el sitio ofrece "Solicitud de base de
  datos" (equiposipc@consumidor.gub.uy). Decisión de Augusto (30/09/2026): no contactarlos;
  se trabaja con el archivo abierto aunque tenga atraso.
- Open Prices (Open Food Facts): abierta y con API, pero casi todo es de Europa.
- **Open Food Facts (productos)**: EAN → nombre, marca y tamaño en varios idiomas; útil para el matching.
- Scraping de tiendas online: descartado (términos de uso, fragilidad, portafolio público y,
  sobre todo, no cubre los comercios de frontera, que es lo que falta).

### Hallazgos de SEPA (30/09/2026)

- `datos.produccion.gob.ar` responde **403** desde Uruguay, tanto a `curl` como al navegador de
  Augusto (otros proyectos documentan que bloquea IPs de datacenter; desde Argentina, conexión
  doméstica, funciona). No se intenta esquivar el bloqueo.
- El portal publica un ZIP por día de la semana que se pisa cada semana: **no guarda historia**.
  La copia en datos.gob.ar está desactualizada (julio 2026); el portal real se actualiza a diario.
- **Archivo histórico:** el proyecto [preciazo](https://github.com/catdevnull/preciazo) guarda
  todos los días de SEPA desde el 19/08/2024 en un bucket público de Backblaze; el índice está en
  [catdevnull/sepa-precios-metadata](https://github.com/catdevnull/sepa-precios-metadata)
  (`index.md`/`index.json`). 765 días, 691 descargables, formato `.tar.zst` (reempaquetado).
  Incluye el **31/12/2025** (69 MB), el mismo último día que el SIPC: permite comparar en la
  **misma fecha** sin ajustar por inflación. La licencia CC BY 4.0 de SEPA permite redistribuir;
  hay que citar a la Secretaría de Comercio como fuente y a preciazo como archivo.

## Próximos pasos

Para el objetivo actual (web de compras al menor costo en Uruguay):

1. ~~Categorías genéricas~~ ✅ (30/09/2026): `sql/transform/sipc_catalogo.sql` (paso
   `catalogo` del pipeline). Tabla de correspondencias curada a mano: 193 tipos del SIPC →
   **137 genéricos en 10 categorías** (variedades agrupadas: "Manzana Fuji" → "Manzana").
   Cada genérico tiene una unidad base (kg, l, unidad o **m**: el papel higiénico se compara
   por metro). 30 productos quedan sin vincular (útiles en hojas o sin cantidad, Repollo
   Blanco por unidad, Crema facial y Talco en ml). Vínculos en `core.match_producto` con
   método 'regla'; los marcados `revisado` a mano se respetan al recargar.
2. ~~Capa mart para la web~~ ✅ (30/09/2026): `sql/init/05_mart.sql` + paso `mart` del
   pipeline. `mart.precio_actual` (último precio por comercio y producto, solo de los últimos
   30 días del dato), `mart.precio_generico` (cada producto útil para cada genérico, con su
   tamaño), `mart.generico` (con `se_vende_suelto` y `comercios_con_precio`), `mart.ciudad`
   (departamento, ciudad y centro para el mapa) y la función
   `mart.cotizar_canasta(canasta jsonb, lat, lon, radio_km, presupuesto)`: ordena por
   cobertura y total, no fracciona paquetes (1 l de aceite = 2 botellas de 900 cc), frutas,
   verduras y carnes por kg se venden sueltas, e informa faltantes y detalle. ~65 ms.
   Hallazgo: **31 frutas y verduras no tienen ningún precio en 2025** y los útiles escolares
   solo de agosto a octubre: la web ofrece los 84 genéricos con precios vigentes.
   Pendiente para después: combinar 2 comercios cercanos.
3. ~~API (FastAPI)~~ ✅ (30/09/2026): `api/main.py` + servicio `api` del compose
   (http://localhost:8000/docs). Endpoints: `GET /salud`, `/ciudades`, `/genericos`,
   `/comercios?lat&lon&radio_km`, `POST /canasta/cotizar`. Validación con Pydantic (422:
   fuera del rectángulo de Uruguay, cantidades ≤ 0, repetidos, ids inexistentes); el
   rectángulo es grueso (Buenos Aires queda adentro), pero ahí la respuesta es `[]`.
   Conexión de solo lectura (`default_transaction_read_only`, verificado). 14 tests en
   `tests/test_api.py` contra la base real: `docker compose run --rm pipelines pytest -v`.
   Pendiente para el despliegue: un rol de Postgres propio con solo SELECT.
4. **Web:** mapa (Leaflet + OpenStreetMap) para elegir la ubicación, armar la canasta y ver
   los resultados.
5. **Usuarios y tickets:** cuentas, subir el ticket (investigar el QR del CFE de la DGI;
   si no alcanza, foto + extracción con IA), comparar con la compra anterior.
6. Calidad: guardar el reporte de cada carga en una tabla. Despliegue en un VPS.

Fuera de alcance por ahora: SEPA, tipos de cambio (PTAX/BCU/BCRA), NFC-e de Brasil.

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
