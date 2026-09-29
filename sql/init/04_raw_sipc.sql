-- Capa raw del SIPC (Uruguay): una tabla por archivo, con las mismas columnas y en el
-- mismo orden que el CSV, porque COPY asigna los valores por posición.
--
-- Criterios de la capa raw:
--   * Los ids se guardan tal cual vienen: son los que usan los otros archivos para
--     referenciarse (precios.presentacion_producto = productos.id_producto).
--   * Sin claves foráneas ni NOT NULL de más: una fila rara no debe frenar la carga.
--     Los problemas se detectan después con consultas de calidad.
--   * Lo que no se puede tipar sin transformar queda como text (ej.: coordenadas con
--     coma decimal y nombres lat/long cruzados). Se corrige en core.

-- productos.csv: una fila = una presentación de producto
CREATE TABLE raw.sipc_productos (
    id_producto     integer PRIMARY KEY,
    producto        text,       -- tipo de producto sin marca: "Aceite de girasol"
    marca           text,
    especificacion  text,       -- "Envase 900 cc": la cantidad y la unidad se separan en core
    nombre          text        -- producto + marca + especificacion
);

-- establecimiento.csv: una fila = un comercio (sucursal)
CREATE TABLE raw.sipc_establecimientos (
    id_establecimiento  integer PRIMARY KEY,
    razon_social        text,
    nombre_sucursal     text,
    direccion           text,
    ccz                 integer,    -- centro comunal zonal (solo Montevideo)
    barrio              text,
    cajas               integer,
    cadena              text,
    long                text,       -- ¡OJO! trae la LATITUD, con coma decimal ("-34,87")
    lat                 text,       -- ¡OJO! trae la LONGITUD, con coma decimal ("-56,18")
    ciudad              text,
    depto               text,
    id_depto            integer,
    localidad           integer,
    superficie_m2       integer
);

-- precios_AAAA.csv: una fila = el precio de un producto, en un comercio, en un día
CREATE TABLE raw.sipc_precios (
    -- numeric y no bigint: el archivo se exportó con notación científica para los ids
    -- "redondos" (175000000 viene como "1.75e+08"); numeric lo acepta y lo guarda exacto.
    id_precio_diario        numeric PRIMARY KEY,
    declaracion             timestamp,  -- fecha y hora en que el comercio envió el dato
    fecha                   date,
    fecha_anterior          date,       -- NULL = el comercio también informó el día anterior
    oferta                  smallint,   -- 1 = precio de oferta, 0 = precio normal
    precio                  numeric,    -- pesos uruguayos, con impuestos
    precio_anterior         numeric,
    publico                 text,       -- NULL = venta al público en general
    establecimiento         integer,    -- → raw.sipc_establecimientos.id_establecimiento
    feria_id                integer,
    presentacion_producto   integer     -- → raw.sipc_productos.id_producto
);
