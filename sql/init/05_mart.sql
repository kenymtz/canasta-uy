-- Capa mart: lo que consume la web (y después la API).
--
-- Las dos vistas materializadas guardan el resultado de consultas pesadas para que la web
-- responda rápido. Se recalculan con REFRESH después de cada carga (paso "mart" del
-- pipeline del SIPC).


-- ─── Ciudades (para el selector de la web) ────────────────────────────────────

-- Una fila por ciudad, con su centro (el promedio de sus comercios) para ubicar el mapa
CREATE VIEW mart.ciudad AS
SELECT departamento,
       ciudad,
       count(*)                                          AS comercios,
       ST_Y(ST_Centroid(ST_Collect(ubicacion::geometry))) AS lat,
       ST_X(ST_Centroid(ST_Collect(ubicacion::geometry))) AS lon
FROM core.establecimiento
WHERE ubicacion IS NOT NULL
GROUP BY departamento, ciudad;


-- ─── Precios vigentes ─────────────────────────────────────────────────────────

-- Último precio de cada producto en cada comercio, solo si es de los últimos 30 días del
-- dato más reciente: un comercio que dejó de informar en marzo no puede competir con
-- precios viejos contra uno que informó en diciembre.
CREATE MATERIALIZED VIEW mart.precio_actual AS
SELECT DISTINCT ON (p.establecimiento_id, p.producto_fuente_id)
       p.establecimiento_id,
       p.producto_fuente_id,
       p.fecha,
       p.precio,
       p.es_oferta
FROM core.precio p
WHERE p.fecha >= (SELECT max(fecha) - 30 FROM core.precio)
ORDER BY p.establecimiento_id, p.producto_fuente_id, p.fecha DESC;

-- Cada producto que sirve para cada genérico en cada comercio, con su tamaño en la unidad
-- base. Se guardan todos (no solo el más barato por kilo) porque, con paquetes enteros,
-- cuál conviene depende de cuánto se pida.
CREATE MATERIALIZED VIEW mart.precio_generico AS
SELECT pa.establecimiento_id,
       m.producto_canonico_id,
       pa.producto_fuente_id,
       pf.descripcion_original                         AS producto,
       core.a_unidad_base(pf.cantidad, pf.unidad)      AS tamano,
       pa.precio,
       round(pa.precio / core.a_unidad_base(pf.cantidad, pf.unidad), 2) AS precio_unitario,
       pa.fecha,
       pa.es_oferta
FROM mart.precio_actual pa
JOIN core.match_producto m   ON m.producto_fuente_id = pa.producto_fuente_id
JOIN core.producto_fuente pf ON pf.id = pa.producto_fuente_id
WHERE core.a_unidad_base(pf.cantidad, pf.unidad) > 0;

CREATE INDEX ON mart.precio_generico (producto_canonico_id, establecimiento_id);


-- ─── Productos genéricos (para armar la canasta) ──────────────────────────────

-- Frutas, verduras y carnes por kilo se venden sueltas: 1,5 kg se paga 1,5 veces el precio
-- por kilo. Todo lo demás viene en paquetes enteros.
-- comercios_con_precio: la web solo ofrece los genéricos con precios vigentes (el SIPC no
-- trae precios de 2025 para 31 frutas y verduras, y los útiles escolares son de temporada).
CREATE VIEW mart.generico AS
SELECT pc.id AS producto_canonico_id,
       pc.nombre,
       pc.categoria,
       pc.unidad_base,
       (pc.categoria IN ('Frutas', 'Verduras', 'Carnes y fiambres') AND pc.unidad_base = 'kg')
           AS se_vende_suelto,
       (SELECT count(DISTINCT pg.establecimiento_id)
          FROM mart.precio_generico pg
         WHERE pg.producto_canonico_id = pc.id)::int AS comercios_con_precio
FROM core.producto_canonico pc;


-- ─── Cotizar una canasta ──────────────────────────────────────────────────────

-- Recibe la canasta como JSON, por ejemplo:
--   '[{"producto_canonico_id": 1, "cantidad": 2}, {"producto_canonico_id": 7, "cantidad": 1.5}]'
-- (cantidades en la unidad base de cada genérico: kg, l, unidad o m), un punto (lat, lon),
-- un radio en km y, opcionalmente, un presupuesto.
--
-- Devuelve un comercio por fila, ordenados primero por cobertura (los que tienen toda la
-- canasta) y después por total. "detalle" dice qué comprar en cada comercio.
CREATE OR REPLACE FUNCTION mart.cotizar_canasta(
    canasta     jsonb,
    lat         double precision,
    lon         double precision,
    radio_km    numeric DEFAULT 5,
    presupuesto numeric DEFAULT NULL
)
RETURNS TABLE (
    establecimiento_id   bigint,
    comercio             text,
    cadena               text,
    direccion            text,
    ciudad               text,
    distancia_km         numeric,
    productos_pedidos    int,
    productos_con_precio int,
    cobertura            numeric,
    total                numeric,
    entra_en_presupuesto boolean,
    faltantes            text[],
    fecha_precios        date,
    detalle              jsonb
)
LANGUAGE sql STABLE AS $$
WITH pedido AS (
    SELECT (i ->> 'producto_canonico_id')::bigint AS producto_canonico_id,
           (i ->> 'cantidad')::numeric            AS cantidad
    FROM jsonb_array_elements(canasta) AS i
),
cercanos AS (
    SELECT e.id, e.nombre, e.cadena, e.direccion, e.ciudad,
           round((ST_Distance(e.ubicacion, ST_MakePoint(lon, lat)::geography) / 1000)::numeric, 2)
               AS distancia_km
    FROM core.establecimiento e
    WHERE ST_DWithin(e.ubicacion, ST_MakePoint(lon, lat)::geography, radio_km * 1000)
),
-- Cada forma de comprar cada ítem en cada comercio, con su costo
opciones AS (
    SELECT c.id AS establecimiento_id,
           pe.producto_canonico_id,
           g.nombre AS generico,
           pe.cantidad,
           pg.producto_fuente_id,
           pg.producto,
           pg.precio,
           pg.fecha,
           CASE WHEN g.se_vende_suelto THEN pe.cantidad / pg.tamano
                ELSE ceil(pe.cantidad / pg.tamano)          -- los paquetes no se fraccionan
           END AS unidades
    FROM cercanos c
    JOIN pedido pe            ON true
    JOIN mart.generico g      ON g.producto_canonico_id = pe.producto_canonico_id
    JOIN mart.precio_generico pg
      ON pg.establecimiento_id = c.id AND pg.producto_canonico_id = pe.producto_canonico_id
),
-- La opción más barata de cada ítem en cada comercio. Si dos cuestan lo mismo, gana la de
-- menor id: así el resultado es siempre el mismo (y coincide con web/src/lib/cotizar.ts)
mejor AS (
    SELECT DISTINCT ON (establecimiento_id, producto_canonico_id)
           *, round(unidades * precio, 2) AS costo
    FROM opciones
    ORDER BY establecimiento_id, producto_canonico_id, unidades * precio, producto_fuente_id
),
por_comercio AS (
    SELECT m.establecimiento_id,
           count(*)::int    AS productos_con_precio,
           sum(m.costo)     AS total,
           min(m.fecha)     AS fecha_precios,
           jsonb_agg(jsonb_build_object(
               'generico', m.generico, 'producto', m.producto, 'cantidad', m.cantidad,
               'unidades', round(m.unidades, 2), 'precio', m.precio, 'costo', m.costo)
               ORDER BY m.generico) AS detalle
    FROM mejor m
    GROUP BY m.establecimiento_id
)
SELECT c.id, c.nombre, c.cadena, c.direccion, c.ciudad, c.distancia_km,
       (SELECT count(*)::int FROM pedido),
       pc.productos_con_precio,
       round(pc.productos_con_precio::numeric / (SELECT count(*) FROM pedido), 2),
       pc.total,
       presupuesto IS NULL OR pc.total <= presupuesto,
       ARRAY(
           SELECT g.nombre FROM pedido pe
           JOIN mart.generico g ON g.producto_canonico_id = pe.producto_canonico_id
           WHERE NOT EXISTS (SELECT 1 FROM mejor m
                             WHERE m.establecimiento_id = c.id
                               AND m.producto_canonico_id = pe.producto_canonico_id)
           ORDER BY g.nombre
       ),
       pc.fecha_precios,
       pc.detalle
FROM cercanos c
JOIN por_comercio pc ON pc.establecimiento_id = c.id
ORDER BY 9 DESC, 10 ASC;       -- cobertura y después total
$$;
