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
- La web muestra la fecha de los precios (hoy, del SIPC 2026: hasta el 30/06/2026).
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

### SIPC 2026 cargado (30/09/2026)

- El pipeline carga ahora **2025 y 2026** (precios hasta el **30/06/2026**): 40.315.906 filas en
  raw, 40.163.889 en core (−189 huérfanos, −151.828 duplicados), 893 comercios (41 nuevos), base
  de 12 GB. La web muestra precios del 31/05 al 30/06/2026. Los catálogos se toman de 2026.
- Cambios de formato de 2026: los vacíos del archivo de comercios vienen como la palabra `NULL`
  (se resuelve con `NULL 'NULL'` en el COPY; `ccz`, `cajas`, `id_depto`, `localidad` y
  `superficie_m2` pasaron a text en raw). Las coordenadas siguen cruzadas.
- **Coordenadas dañadas por Excel** en 9 comercios nuevos: `-3,34E+15` (irrecuperable, se
  descarta) o `-348576993` (se recupera: 2 dígitos enteros). Función `core.coordenada_sipc`.
  Quedan 12 comercios sin ubicación.
- Un tipo cambió de nombre en 2026 ("Hojas de Blancas"); se agregó a la correspondencia.
- Nombres con variantes en 2026 ("CANELONES", "MALDONADO", "Paso de los toros", "Piriapolis"):
  los departamentos se comparan contra la lista oficial de 19 y las ciudades se unifican en la
  variante mejor escrita (con tildes y mayúsculas), sin distinguir mayúsculas ni tildes.

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
4. ~~Web~~ ✅ (30/09/2026): carpeta `web/` (React 19 + Vite 8 + TypeScript, Tailwind v4,
   MapLibre + OpenFreeMap, NumberFlow, Phosphor, zustand), servicio `web` del compose
   (http://localhost:5173, proxy `/api` → API). Diseño "mapa + ticket" aprobado por Augusto
   (spec en `docs/superpowers/specs/2026-09-30-web-canasta-design.md`, plan en
   `docs/superpowers/plans/2026-09-30-web-canasta.md`). Hechos: etiquetas del mapa honestas
   (los comercios incompletos dicen "Faltan N" en lugar de un precio engañoso), sin solapes,
   barra de resumen fija, canasta recordada en el navegador, modo claro y oscuro, contraste
   AA verificado, estados de vacío/error/sin comercios. 18 tests de Vitest y capturas con
   Playwright (`web/scripts/capturas.mjs`, imagen `mcr.microsoft.com/playwright:v1.63.0-noble`).
   Skills de diseño instaladas en `~/.claude/skills` (taste-skill, Emil Kowalski, find-skills).
   Ajustes pedidos por Augusto: se quitó la "Canasta básica" (le pareció redundante) y se
   agregó **Mis listas** (guardar la canasta con un nombre y cargarla con un toque; hoy en el
   navegador, en el paso 5 pasan a la cuenta del usuario). Para darle vida sin cambiar la
   estructura: grano de papel térmico, panel con borde dentado de ticket y sombra sobre el
   mapa, íconos por categoría, resaltador en el título, talón con datos reales (comercios,
   productos, departamentos, fecha) y cantidades animadas.
   Fondo del panel: manchas pastel difusas (menta, durazno, manteca), en lugar de la
   cuadrícula que no le gustó a Augusto. Botón de tema (sol/luna): por defecto sigue al sistema; la elección se guarda en el
   navegador y un script en `index.html` la aplica antes de dibujar (sin destello). El CSS
   usa `:root[data-tema="oscuro"]` en lugar de `prefers-color-scheme`.
4b. ~~Web estática publicada~~ ✅ (30/09/2026): Augusto todavía no puede pagar un servidor,
   así que la web se publica gratis en **Cloudflare Pages** (https://canastauy.pages.dev; al
   principio estuvo en GitHub Pages, que ahora solo redirige a la dirección nueva).
   `canasta-uy.pages.dev` ya lo usaba otra persona. El workflow publica con `wrangler` usando
   los secretos `CLOUDFLARE_API_TOKEN` (permiso Cloudflare Pages: Edit) y
   `CLOUDFLARE_ACCOUNT_ID` del repo; la cuenta de Cloudflare es de Augusto.
   `pipelines/exportar/web_estatica.py` exporta mart a `web/public/datos/` (`base.json`:
   ciudades, genéricos y comercios, 170 KB; `precios.json`: 76 mil precios vigentes en filas
   cortas, 1,2 MB, 250 KB comprimido). Con `VITE_MODO=estatico`, `web/src/lib/api.ts` usa
   `estatico.ts`, que lee esos archivos y cotiza en el navegador con `cotizar.ts` (copia de
   `mart.cotizar_canasta`: **si se cambia una, hay que cambiar la otra**). Paridad
   verificada con `src/lib/paridad.test.ts` (400 canastas, 4.864 comercios idénticos). Para
   lograrla: distancia con Vincenty sobre el elipsoide WGS84 (como PostGIS; con una esfera
   difería 50 m en 20 km), orden alfabético como `en_US.utf8` (ignora espacios, ñ = n) y
   desempate por id del producto cuando dos opciones cuestan lo mismo (se agregó también en
   el SQL). Rutas de `public/` con `rutaPublica()` (`BASE_URL`, por si la web vive en una subcarpeta, como pasaba en GitHub Pages con
   `/canasta-uy/`). Se arregló de paso el build de producción del mapa: el worker de
   MapLibre se importa con `?worker&url` (con `?url` faltaba `maplibre-gl-shared.mjs`).
   Workflow `.github/workflows/publicar.yml`: en cada push a main que toque `web/` compila y
   publica; el día 5 de cada mes (o a mano) corre el pipeline con `--liviano` (solo
   `precios_2026.csv`, 1 GB) en un Postgres temporal, exporta y, si cambiaron los datos,
   hace un commit y publica. **Cuando salga el dataset del SIPC 2027 hay que agregar su URL
   en `RECURSOS`** (es otro dataset, con otro id).
   La primera corrida automática mostró que **los ids de los genéricos cambian** cuando la base
   se arma de cero. Por eso la canasta y Mis listas se guardan en el navegador **por nombre**
   del genérico (versión 2 del store; `migrar` convierte lo guardado por id con la tabla fija
   `web/src/store/nombresVersion1.ts`). Si un producto de una lista ya no tiene precios, la
   canasta lo avisa ("Sin precios vigentes") y no lo cotiza.
5a. ~~Mis compras (sin cuenta)~~ ✅ (30/09/2026): pedido de Augusto: registrar qué compró,
   cuánto y dónde cada vez que sube el ticket, con cuentas opcionales. Parte A (hecha): el
   historial vive en el navegador (`store/compras.ts`, clave `canasta-uy-compras`). El QR da
   fecha, total y RUC; la boleta, los productos (ya sin datos personales); como el RUC no dice
   la sucursal, el usuario marca el comercio entre los cercanos (`ConfirmarCompra.tsx`) y la
   próxima vez con el mismo RUC viene marcado. El id de la compra es el del comprobante (no
   se guarda dos veces el mismo ticket). `MisCompras.tsx` muestra cada compra con la
   diferencia contra la anterior y qué productos cambiaron de precio (mismo texto de boleta,
   sin mayúsculas, tildes ni espacios de más). Lógica pura y tests en `lib/compras.ts`.
   Aviso: "Sin cuenta, tus compras quedan solo en este teléfono... iniciar sesión (no es
   obligatorio)". Parte B (pendiente): cuentas con **Supabase** (Postgres + Auth, plan gratis,
   inicio con Google, Row Level Security, región en Europa por la Ley 18.331), sincronizar el
   historial, botón para borrar cuenta y datos, página de privacidad, registro en la URCDP.
   Parte C (después): usar los tickets para actualizar precios públicos, con controles.
5b. **Cuentas con Supabase** (código listo en la rama `cuentas`, sin publicar hasta que esté
   configurado): proyecto `canasta-uy` de Augusto (organización "Augusto", plan Free, región
   Central EU Frankfurt, Data API sí, exponer tablas solas no, RLS automática sí). URL
   `https://cbabonwbwvzpkisgmusn.supabase.co` y clave publicable en `web/src/lib/nube.ts`
   (son públicas; la secret key y la contraseña de la base nunca salen de Supabase).
   `sql/supabase/01_compras.sql`: tabla `public.compra` (una fila por ticket y usuario, productos
   en jsonb), RLS con una regla por acción (ver, guardar, borrar; sin editar), y
   `borrar_mi_cuenta()` (SECURITY DEFINER, borra auth.users y en cascada sus compras). Probado
   en local imitando Supabase: `sql/supabase/prueba_rls.sql` (incluye un control de que la
   prueba detecta una regla rota). Web: `store/compras.ts` guarda siempre en el navegador y,
   con sesión, también en la cuenta; al entrar sube lo que falta y trae lo de la cuenta; al
   salir quita el historial del teléfono. `hooks/useSesion.ts`, `components/Cuenta.tsx`
   (entrar con Google, salir, borrar cuenta), `public/privacidad.html`. Workflow
   `mantener-supabase.yml`: dos consultas por semana para que el plan gratis no se pause.
   Falta: correr el SQL en Supabase, configurar Google (OAuth) y probar con una cuenta real.
   Antes de anunciarla: registrar la base en la URCDP.
   **Publicado el 01/10/2026** (Google publicado con página principal y privacidad; dominios
   autorizados canastauy.pages.dev y el de Supabase). Primera prueba real de un usuario: el QR
   se leyó bien.
   Lectura de boletas reales (prueba con un ticket de Macromercado, 01/10/2026): con una foto
   arrugada y en ángulo, tesseract lee mal los precios aunque se amplíe, se binarice o se lea
   como un bloque. Se mejoró el filtro (letra de IVA pegada al monto, columnas de cantidad y
   precio unitario, código de artículo, recuadro de impuestos "T.M.Imp."/"IVA T.B." y ruido
   con menos de 3 letras), la lectura (ampliar a 2400 px, `PSM.SINGLE_BLOCK`) y, sobre todo,
   la lista ahora se **revisa y corrige** antes de guardar (`RevisarProductos.tsx`), se puede
   escribir a mano y se avisa si la suma no coincide con el total del QR. Opción a futuro, con
   consentimiento explícito: leer el recorte con IA (Gemini), lo que rompería la promesa de
   que la foto no sale del teléfono. **Augusto la descartó (01/10/2026): sin IA.**
   Pedido de Augusto: poder **subir** una foto o captura además de sacarla (`ElegirFoto.tsx`,
   en el QR y la boleta) y un **banco de pruebas** para generar muchas boletas y medir en
   Docker: `eval/boletas/` (`docker compose run --rm eval-boletas`; ver su README). La lectura
   se separó en `web/src/lib/lectorBoleta.ts` para que el banco use el mismo código que la
   web. Primeros hallazgos y arreglos: el lector mete un espacio después de la coma
   ("407, 32B") y signos al final ("250,42?"), y faltaban los productos en dos renglones
   ("2 x 176,55   353,10"). Con eso, leyendo el recorte: de 40 % a 70 % de productos
   encontrados (92 % con fotos limpias, 21 % con fotos muy dañadas) y 0 fugas. Decisión: un
   renglón que parece tarjeta tapada ("XxX 176") se borra aunque sea un producto mal leído.
   Las fotos reales van en `eval/boletas/reales/` (no se suben a GitHub).
   Augusto (01/10/2026): la opción de subir una foto tiene que andar con fotos comprimidas
   (WhatsApp, capturas), no solo con originales; si no, es poco fiable. Se agregó el nivel
   "whatsapp" al banco (renglones de ~20 px como la boleta real) y `variar.mjs` (versiones
   de cada foto real). Mejoras medidas: precios sin coma en columnas ("1000 4528" = 1,000 ×
   45,28, con control cantidad × unitario = monto), monto calculado si falta su columna,
   código de artículo mal leído ("H575") y niveles automáticos + ampliar a 1800 px
   (`PREPARACION` en `lectorBoleta.ts`). Boleta real por WhatsApp: de 0 % a 67 % de precios
   exactos leyendo el recorte. Pendiente: más boletas reales comprimidas de distintos
   comercios; las falsas siguen siendo más fáciles que las reales.
   Boleta inventada por Augusto (formato Macromercado, impresión nítida; **solo para pruebas,
   no cargar en ninguna base**): 100 % original, por WhatsApp y en capturas; 29 % muy dañada.
   Conclusión: lo que más pesa es la calidad de la impresión, no si la foto vino por WhatsApp.
   Boletas inventadas de Disco y Tata (limpias y gastadas, **solo para pruebas**): formato con
   la cantidad al principio. Arreglos: limpiar cantidad y signos sueltos del nombre, no cortar
   números del nombre ("1506" = 150G mal leído) y **dos lecturas** (normal y con el fondo
   aplanado; se queda la que tiene más productos, `PASADAS`). Limpias: 100 % original, ~90-97 %
   con versiones WhatsApp y captura. Gastadas: de 9 % a 21-26 %. Boletas falsas: 58 % → 65 %.
**Decisión de Augusto (01/10/2026): las boletas sirven solo para el historial.** Queda para
el futuro: unir cada producto del ticket con su genérico (para decir "esta compra en otro
comercio salía $ X") y la parte C (que los tickets actualicen los precios de cada comercio,
con controles contra datos falsos). Orden acordado para seguir: 1) cerrar lo pendiente antes
de mostrarla (contacto en privacidad: **uycanasta@gmail.com**; datos para la URCDP en
`docs/URCDP.md`; README y capturas al día), 3) precios de frutas y verduras (el SIPC no los
trae; investigar el Mercado Modelo), 4) cosas chicas (en qué cuenta de Cloudflare quedó el
proyecto `canastauy`; URL del SIPC 2027 cuando salga).
Hecho el 01/10/2026: contacto en privacidad, `docs/URCDP.md`, README con capturas nuevas. Falta
de Augusto: nada. Verificación en dos pasos activada el 01/10/2026 en Supabase, Cloudflare,
GitHub y Google (cuenta personal y uycanasta@gmail.com); la cuenta de Cloudflare, creada con
Google, ahora también tiene contraseña propia.
**URCDP: trámite enviado el 01/10/2026** (Registro de Base de Datos, persona física, "Canasta
UY: cuentas e historial de compras"), estado "Pendiente de Revisión"; las respuestas quedaron
en `docs/URCDP.md`. Sin encargado cargado en 4.2 (el formulario pide RUT y representante, que
Supabase no tiene en Uruguay); declarado como ubicación de un tercero y transferencia a la UE y
a Singapur. Si la URCDP pide aclaración, llega a uycanasta@gmail.com. Frutas y verduras: la fuente es la UAM (ver `docs/FUENTES.md`);
**en espera de que la UAM responda** si se pueden reutilizar sus precios (Augusto mandó
el mail desde uycanasta@gmail.com el 01/10/2026). SIPC de un año
nuevo: la actualización mensual lo detecta sola (`pipelines/fuentes/sipc_anio_nuevo.py`) y
abre un issue en GitHub con lo que hay que hacer. Cloudflare: el proyecto `canastauy` está en la cuenta de Augusto
(verificado el 01/10/2026); "No Git connection" es lo esperado (publica el workflow con
wrangler; no conectar Git en Cloudflare o se publicaría dos veces).

5. **Usuarios y tickets:** cuentas, subir el ticket (investigar el QR del CFE de la DGI;
   si no alcanza, foto + extracción con IA), comparar con la compra anterior.
6. Calidad: guardar el reporte de cada carga en una tabla. Servidor propio cuando se pueda
   pagar (o Oracle Cloud Always Free): lo necesitan las cuentas y los tickets del paso 5.

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
