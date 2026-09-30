# Fuentes de datos

Registro de dónde salen (o pueden salir) los datos del proyecto, con lo que se aprendió de
cada una. Última revisión: 30/09/2026.

## En uso

### SIPC – Sistema de Información de Precios al Consumidor (Uruguay)

- Responsable: Unidad de Defensa del Consumidor (MEF). Contacto: equiposipc@consumidor.gub.uy
- Dataset 2025: https://catalogodatos.gub.uy/dataset/defensa-del-consumidor-sistema-de-informacion-de-precios-al-consumidor-2025
- Histórico 2007–2022: https://catalogodatos.gub.uy/dataset/declaraciones-al-sistema-de-informacion-de-precios-al-consumidor-2019
- Listado de datasets de precios: https://catalogodatos.gub.uy/dataset/?tags=Precios
- Sitio y app con precios actuales (sin API ni descarga): https://precios.uy
- Licencia: Licencia de Datos Abiertos del Uruguay (DAG).
- Frecuencia: un archivo de precios por año, actualizado cada trimestre. Último dato: 31/12/2025.

Archivos que usa `pipelines/fuentes/sipc.py`:

| Archivo | URL |
|---|---|
| Precios 2025 (2 GB) | https://catalogodatos.gub.uy/dataset/35d8f45e-2aa7-48b5-98dd-f973b05cf8ba/resource/36c62bab-b7e4-4c9e-ad9b-4c1182090a22/download/precios_2025.csv |
| Productos | https://catalogodatos.gub.uy/dataset/35d8f45e-2aa7-48b5-98dd-f973b05cf8ba/resource/ed042b97-12ce-46ff-a169-b2594337a6e4/download/productos.csv |
| Establecimientos | https://catalogodatos.gub.uy/dataset/35d8f45e-2aa7-48b5-98dd-f973b05cf8ba/resource/5fbdd7e8-97fa-44db-b978-4381670c8933/download/establecimiento.csv |
| Metadatos de precios | https://catalogodatos.gub.uy/dataset/35d8f45e-2aa7-48b5-98dd-f973b05cf8ba/resource/4dbc5f3a-614e-4f31-aeac-cc1ee389589b/download/metadatos_precios.csv |
| Metadatos de productos | https://catalogodatos.gub.uy/dataset/35d8f45e-2aa7-48b5-98dd-f973b05cf8ba/resource/42d57eac-7277-4d8a-b334-fd0af5f9aa4a/download/metadatos-productos.csv |
| Metadatos de establecimientos | https://catalogodatos.gub.uy/dataset/35d8f45e-2aa7-48b5-98dd-f973b05cf8ba/resource/25c81cc0-0d51-4161-a393-bd1ed3120dc8/download/metadatos-establecimientos.csv |
| Nota metodológica (ODT) | https://catalogodatos.gub.uy/dataset/35d8f45e-2aa7-48b5-98dd-f973b05cf8ba/resource/8ef6a15b-a9ce-4deb-9eae-bcf797752b7a/download/documentacion-bases-de-datos.odt |

## Para más adelante (Uruguay)

- **Tickets electrónicos (CFE) de la DGI:** los tickets uruguayos traen un QR de la DGI.
  Falta investigar si permite obtener los ítems o solo el total. https://www.gub.uy/direccion-general-impositiva
- **Open Food Facts** (productos por código de barras, nombre, marca y tamaño; licencia ODbL):
  https://world.openfoodfacts.org — útil si los tickets traen EAN.
- **Open Prices** (precios colaborativos de Open Food Facts, con API): https://prices.openfoodfacts.org
  — hoy casi todo es de Europa.
- **IPC del INE** (inflación oficial, sin detalle por comercio): https://www.gub.uy/instituto-nacional-estadistica
  — sirve para mostrar o ajustar la antigüedad de los precios.

## Fuera de alcance (se exploró; se deja para un futuro)

Decisión del 30/09/2026: el proyecto queda solo en Uruguay.

### SEPA – Precios Claros (Argentina)

- Portal oficial: https://datos.produccion.gob.ar/dataset/sepa-precios (licencia CC BY 4.0).
  Responde **403 desde Uruguay**, tanto a programas como al navegador.
- Copia en el portal nacional (metadatos desactualizados, julio 2026):
  https://datos.gob.ar/dataset/precios-claros-base-sepa
- Términos y condiciones: https://www.preciosclaros.gob.ar/terminos_y_condiciones.html
- **Archivo histórico diario** desde el 19/08/2024, hecho por el proyecto preciazo:
  - Índice: https://github.com/catdevnull/sepa-precios-metadata (`index.md` e `index.json`,
    este último en https://raw.githubusercontent.com/catdevnull/sepa-precios-metadata/main/index.json)
  - Proyecto: https://github.com/catdevnull/preciazo
  - Archivos en `https://f004.backblazeb2.com/file/precios-justos-datasets/...` (`.tar.zst`).
  - Ejemplo usado en la exploración (30/12/2025, 74 MB):
    https://f004.backblazeb2.com/file/precios-justos-datasets/9dc06241-cc83-44f4-8e25-c9b1636b8bc8-revID-e5a114a6-18d4-4ed8-bd95-bb8528274672-sepa_martes.zip-repackaged.tar.zst
- Formato: una carpeta por empresa con `comercio.csv`, `sucursales.csv` y `productos.csv`;
  UTF-8 con BOM, separador `|`, y una línea final "Última actualización: ..." que no es CSV.
  Unos 15 M de precios por día; Entre Ríos ~490 mil. Trae EAN (99 %), pero las unidades
  vienen en más de 15 combinaciones distintas según la cadena.

### Brasil

- **PTAX – Banco Central do Brasil** (cotización del dólar, API abierta):
  https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/ — pipeline en
  `pipelines/cambio/bcb_ptax.py` (se mantiene el código; los datos se borraron de la base).
- **NFC-e (SEFAZ-RS):** ticket electrónico de Rio Grande do Sul, legible por QR. https://www.sefaz.rs.gov.br
- **Menor Preço – Nota Gaúcha:** tiene precios de RS pero sin API pública; descartado.

### Tipos de cambio (no implementados)

- BCU (Uruguay): https://www.bcu.gub.uy
- BCRA (Argentina): https://www.bcra.gob.ar

## Descartado

- **Scraping de tiendas online:** términos de uso, fragilidad y mala señal en un repo público.
