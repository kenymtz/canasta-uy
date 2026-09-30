-- Funciones de unidades, usadas por core y mart.

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
        WHEN 'm'  THEN cantidad
    END
$$;

-- Unidad base en la que se compara una unidad: 'kg', 'l', 'unidad' o 'm' (NULL si no se
-- puede, por ejemplo hojas o centímetros).
CREATE FUNCTION core.unidad_base(unidad text)
RETURNS text
LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE
        WHEN lower(trim(unidad)) IN ('ml', 'cc', 'l', 'lt')     THEN 'l'
        WHEN lower(trim(unidad)) IN ('g', 'gr', 'kg')           THEN 'kg'
        WHEN lower(trim(unidad)) IN ('un', 'u', 'unidad')       THEN 'unidad'
        WHEN lower(trim(unidad)) = 'm'                          THEN 'm'
    END
$$;
