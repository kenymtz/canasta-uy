-- SIPC (Uruguay): de la capa raw a core.
--
-- Lo ejecuta pipelines/fuentes/sipc.py dentro de UNA transacción: o se aplica todo o nada.
-- Es idempotente: comercios y productos se actualizan si ya existen (upsert) y los precios
-- del período que trae el archivo se reemplazan, así core queda igual a la fuente.

-- Más memoria para ordenar los 27 M de precios sin escribir a disco (solo en esta transacción)
SET LOCAL work_mem = '256MB';


-- 1. Comercios ────────────────────────────────────────────────────────────────

-- Texto de coordenada del SIPC → número. Viene con coma decimal ("-34,8765665"), pero algunos
-- comercios de 2026 pasaron por Excel y perdieron la coma: "-348576993" se recupera (en
-- Uruguay latitud y longitud tienen siempre 2 dígitos enteros), mientras que "-3,34E+15"
-- ya perdió precisión (quedan 3 cifras, ~11 km) y se descarta.
CREATE OR REPLACE FUNCTION core.coordenada_sipc(texto text) RETURNS numeric
LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE
        WHEN t ~* 'e' THEN NULL
        WHEN t ~ '^-?\d{7,}$' THEN (left(t, strpos(t, '-') + 2) || '.' || substr(t, strpos(t, '-') + 3))::numeric
        WHEN t ~ '^-?\d+([.,]\d+)?$' THEN replace(t, ',', '.')::numeric
    END
    FROM (SELECT nullif(trim(texto), '') AS t) x
$$;

WITH coordenadas AS (
    SELECT e.*,
           -- Los nombres vienen cruzados: la columna "long" trae la latitud y "lat" la longitud.
           core.coordenada_sipc(e.long) AS latitud,
           core.coordenada_sipc(e.lat)  AS longitud
    FROM raw.sipc_establecimientos e
),
corregidas AS (
    SELECT c.*,
           -- Uruguay está entero en el hemisferio sur: una latitud positiva es un signo perdido
           CASE WHEN c.latitud > 0 THEN -c.latitud ELSE c.latitud END AS latitud_ok
    FROM coordenadas c
),
-- Los nombres vienen con variantes ("CANELONES", "Piriapolis" / "Piriápolis"). Departamentos:
-- se comparan contra la lista oficial; ciudades: se unifican en la forma más usada.
departamentos (nombre) AS (
    VALUES ('Artigas'), ('Canelones'), ('Cerro Largo'), ('Colonia'), ('Durazno'), ('Flores'),
           ('Florida'), ('Lavalleja'), ('Maldonado'), ('Montevideo'), ('Paysandú'), ('Río Negro'),
           ('Rivera'), ('Rocha'), ('Salto'), ('San José'), ('Soriano'), ('Tacuarembó'), ('Treinta y Tres')
),
ciudades AS (
    -- La mejor escrita: con tildes y con más mayúsculas ("Paso de los Toros" antes que
    -- "Paso de los toros", aunque esta aparezca más veces); la frecuencia solo desempata
    SELECT DISTINCT ON (clave) clave, nombre
    FROM (
        SELECT lower(unaccent(trim(ciudad))) AS clave, trim(ciudad) AS nombre, count(*) AS n
        FROM raw.sipc_establecimientos
        GROUP BY 1, 2
    ) variantes
    ORDER BY clave, (nombre <> unaccent(nombre)) DESC, length(regexp_replace(nombre, '[^[:upper:]]', '', 'g')) DESC, n DESC
)
INSERT INTO core.establecimiento
    (fuente_id, id_externo, pais, nombre, cadena, direccion, ciudad, departamento,
     ubicacion, actualizado_en)
SELECT
    f.id,
    c.id_establecimiento::text,
    'UY',
    -- trim: algunos textos traen espacios al final ("Ta - Ta - D.Lamas (Salto) ")
    trim(c.nombre_sucursal),
    nullif(trim(c.cadena), 'Sin Cadena'),           -- "Sin Cadena" significa que no tiene
    trim(c.direccion),
    coalesce(ci.nombre, trim(c.ciudad)),
    coalesce(d.nombre, trim(c.depto)),
    -- Solo se guarda la ubicación si cae dentro del rectángulo de Uruguay; si no (por ejemplo,
    -- el comercio geocodificado en Ezeiza), queda NULL: mejor sin ubicación que una falsa.
    CASE WHEN c.latitud_ok BETWEEN -35.1 AND -30.0 AND c.longitud BETWEEN -58.5 AND -53.0
         THEN ST_SetSRID(ST_MakePoint(c.longitud, c.latitud_ok), 4326)::geography
    END,
    now()
FROM corregidas c
CROSS JOIN (SELECT id FROM core.fuente WHERE codigo = 'sipc') f
LEFT JOIN departamentos d ON lower(unaccent(d.nombre)) = lower(unaccent(trim(c.depto)))
LEFT JOIN ciudades ci     ON ci.clave = lower(unaccent(trim(c.ciudad)))
ON CONFLICT (fuente_id, id_externo) DO UPDATE SET
    nombre         = EXCLUDED.nombre,
    cadena         = EXCLUDED.cadena,
    direccion      = EXCLUDED.direccion,
    ciudad         = EXCLUDED.ciudad,
    departamento   = EXCLUDED.departamento,
    ubicacion      = EXCLUDED.ubicacion,
    actualizado_en = EXCLUDED.actualizado_en;


-- 2. Productos ────────────────────────────────────────────────────────────────

-- "especificacion" es texto libre con más de 100 formatos ("Envase 900 cc", "Paquete1 kg.",
-- "Botella 2,25.lt.", "Envase 1/2 docena"...). Se busca un número seguido de una unidad.
WITH partes AS (
    SELECT p.*,
           regexp_match(lower(p.especificacion),
               '(1/2|[0-9]+(?:[.,][0-9]+)?)[ .]*'
               '(kg|gramos|grs?|cc|cm3|ml|lts?|us|unidad(?:es)?|docena|hojas|rollos|cm)'
           ) AS m,
           -- Papel higiénico: "4 rollos de 30 mts." se compara por metro (4 × 30 = 120 m);
           -- por rollo, un paquete de 30 m parecería igual que uno de 50 m.
           regexp_match(lower(p.especificacion), '([0-9]+) rollos de ([0-9]+) *mts') AS rollos
    FROM raw.sipc_productos p
),
numeros AS (
    SELECT pa.*,
           CASE
               WHEN pa.rollos IS NOT NULL THEN pa.rollos[1]::numeric * pa.rollos[2]::numeric
               WHEN pa.m[1] = '1/2'       THEN 0.5
               ELSE replace(pa.m[1], ',', '.')::numeric
           END AS n,
           CASE WHEN pa.rollos IS NOT NULL THEN 'm' ELSE pa.m[2] END AS u
    FROM partes pa
)
INSERT INTO core.producto_fuente
    (fuente_id, id_externo, descripcion_original, tipo, marca, cantidad, unidad)
SELECT
    f.id,
    n.id_producto::text,
    n.nombre,
    n.producto,
    -- "Sin marca", "Con Hueso - Sin Marca"... significan que no tiene marca
    CASE WHEN n.marca ~* '(^|- *)sin marca$' THEN NULL ELSE nullif(trim(n.marca), '') END,
    CASE WHEN n.u = 'docena' THEN n.n * 12 ELSE n.n END,
    -- Unidades normalizadas a un conjunto chico, las que entiende core.a_unidad_base
    CASE
        WHEN n.u IN ('grs', 'gr', 'gramos')              THEN 'g'
        WHEN n.u IN ('cc', 'cm3', 'ml')                  THEN 'ml'
        WHEN n.u IN ('lt', 'lts')                        THEN 'l'
        WHEN n.u IN ('us', 'unidad', 'unidades', 'docena') THEN 'unidad'
        WHEN n.u = 'hojas'                               THEN 'hoja'
        WHEN n.u = 'rollos'                              THEN 'rollo'
        ELSE n.u                                         -- kg, m, cm o NULL si no se reconoce
    END
FROM numeros n
CROSS JOIN (SELECT id FROM core.fuente WHERE codigo = 'sipc') f
ON CONFLICT (fuente_id, id_externo) DO UPDATE SET
    descripcion_original = EXCLUDED.descripcion_original,
    tipo                 = EXCLUDED.tipo,
    marca                = EXCLUDED.marca,
    cantidad             = EXCLUDED.cantidad,
    unidad               = EXCLUDED.unidad;


-- 3. Precios ──────────────────────────────────────────────────────────────────

-- Se borran los precios del SIPC del mismo período que trae el archivo y se vuelven a
-- insertar. Con un upsert, una fila que la fuente eliminó quedaría para siempre en core.
DELETE FROM core.precio p
USING core.producto_fuente pf, core.fuente f
WHERE pf.id = p.producto_fuente_id
  AND pf.fuente_id = f.id
  AND f.codigo = 'sipc'
  AND p.fecha BETWEEN (SELECT min(fecha) FROM raw.sipc_precios)
                  AND (SELECT max(fecha) FROM raw.sipc_precios);

-- DISTINCT ON se queda con la PRIMERA fila de cada grupo (fecha, comercio, producto) según
-- el ORDER BY: la del último envío del día y, si empatan, la de mayor id. Así se eliminan
-- los ~104 mil duplicados y se cumple la clave primaria de core.precio.
-- Los JOIN descartan los precios de comercios que no están en el catálogo, y el WHERE los
-- inválidos (hoy no hay ninguno, pero uno solo haría fallar toda la carga por el CHECK).
INSERT INTO core.precio (fecha, establecimiento_id, producto_fuente_id, precio, moneda, es_oferta)
SELECT DISTINCT ON (r.fecha, e.id, pf.id)
    r.fecha,
    e.id,
    pf.id,
    round(r.precio, 2),        -- ~81 mil precios traen 3 decimales; se redondea al centésimo
    'UYU',
    r.oferta = 1
FROM raw.sipc_precios r
JOIN core.fuente f           ON f.codigo = 'sipc'
JOIN core.establecimiento e  ON e.fuente_id = f.id  AND e.id_externo  = r.establecimiento::text
JOIN core.producto_fuente pf ON pf.fuente_id = f.id AND pf.id_externo = r.presentacion_producto::text
WHERE r.precio > 0 AND r.fecha IS NOT NULL
ORDER BY r.fecha, e.id, pf.id, r.declaracion DESC, r.id_precio_diario DESC;

ANALYZE core.establecimiento;
ANALYZE core.producto_fuente;
ANALYZE core.precio;
