-- Vistas de consumo (schema mart).

-- Cantidad de un producto expresada en la unidad base de su canónico (kg, l, unidad).
CREATE FUNCTION core.a_unidad_base(cantidad numeric, unidad text)
RETURNS numeric
LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE lower(trim(unidad))
        WHEN 'ml' THEN cantidad / 1000
        WHEN 'cc' THEN cantidad / 1000
        WHEN 'l'  THEN cantidad
        WHEN 'lt' THEN cantidad
        WHEN 'g'  THEN cantidad / 1000
        WHEN 'gr' THEN cantidad / 1000
        WHEN 'kg' THEN cantidad
        WHEN 'un' THEN cantidad
        WHEN 'u'  THEN cantidad
        WHEN 'unidad' THEN cantidad
    END
$$;

-- Precio de cada producto en cada comercio, llevado a USD y a la unidad base del
-- producto canónico, para comparar entre países. Usa el último tipo de cambio
-- oficial disponible a la fecha del precio.
CREATE VIEW mart.precio_comparable AS
SELECT
    p.fecha,
    e.pais,
    e.ciudad,
    e.id                AS establecimiento_id,
    e.nombre            AS establecimiento,
    e.cadena,
    pc.id               AS producto_canonico_id,
    pc.nombre           AS producto,
    pc.unidad_base,
    pf.descripcion_original,
    p.precio,
    p.moneda,
    fx.por_usd,
    round(p.precio / fx.por_usd, 4) AS precio_usd,
    round(
        (p.precio / fx.por_usd)
        / nullif(core.a_unidad_base(pf.cantidad, pf.unidad), 0),
        4
    )                   AS usd_por_unidad_base,
    m.metodo            AS metodo_match,
    m.confianza         AS confianza_match,
    p.es_oferta
FROM core.precio p
JOIN core.establecimiento   e  ON e.id  = p.establecimiento_id
JOIN core.producto_fuente   pf ON pf.id = p.producto_fuente_id
JOIN core.match_producto    m  ON m.producto_fuente_id = pf.id
JOIN core.producto_canonico pc ON pc.id = m.producto_canonico_id
LEFT JOIN LATERAL (
    SELECT t.por_usd
    FROM core.tipo_cambio t
    WHERE t.moneda = p.moneda
      AND t.tipo = 'oficial'
      AND t.fecha <= p.fecha
    ORDER BY t.fecha DESC
    LIMIT 1
) fx ON true;
