-- SIPC: catálogo de productos genéricos (sin marca) y su vínculo con los productos del SIPC.
--
-- La tabla de abajo es la decisión curada a mano de este paso: qué "tipo" del SIPC
-- corresponde a qué producto genérico y en qué categoría va. Reglas usadas:
--   * Las variedades se agrupan: "Manzana Fuji" y "Manzana Granny Smith" → "Manzana".
--     En cada comercio cuenta la variedad más barata; la web muestra cuál es.
--   * Los casi duplicados se unen: "Tempera" y "Temperas" → "Témperas".
--   * Nombres cortos y claros: "Pollo entero fresco con menudos" → "Pollo entero".
--
-- Cada genérico se compara en UNA unidad base (kg, l, unidad o m): la de la mayoría de
-- sus productos. Los productos en otra unidad (la "Crema facial" en ml cuando el resto
-- está en gramos) o sin cantidad quedan sin vincular, y lo informa el reporte.
--
-- Lo ejecuta pipelines/fuentes/sipc.py en una transacción, después del paso a core.
-- Es idempotente: los genéricos se crean si no existen y los vínculos se rehacen.

CREATE TEMP TABLE correspondencia (tipo_sipc text, generico text, categoria text) ON COMMIT DROP;

INSERT INTO correspondencia (tipo_sipc, generico, categoria) VALUES
    -- Almacén
    ('Aceite de girasol',               'Aceite de girasol',        'Almacén'),
    ('Aceite de maíz',                  'Aceite de maíz',           'Almacén'),
    ('Aceite de soja',                  'Aceite de soja',           'Almacén'),
    ('Arroz blanco',                    'Arroz blanco',             'Almacén'),
    ('Arvejas',                         'Arvejas secas',            'Almacén'),
    ('Arvejas en conserva',             'Arvejas en conserva',      'Almacén'),
    ('Azúcar blanco',                   'Azúcar',                   'Almacén'),
    ('Café envasado (no instantáneo)',  'Café molido',              'Almacén'),
    ('Cocoa',                           'Cocoa',                    'Almacén'),
    ('Dulce de membrillo',              'Dulce de membrillo',       'Almacén'),
    ('Fideos secos al huevo',           'Fideos al huevo',          'Almacén'),
    ('Fideos secos semolados',          'Fideos semolados',         'Almacén'),
    ('Galletitas al agua',              'Galletitas al agua',       'Almacén'),
    ('Harina de maíz',                  'Harina de maíz',           'Almacén'),
    ('Harina trigo común 000',          'Harina de trigo 000',      'Almacén'),
    ('Harina trigo común 0000',         'Harina de trigo 0000',     'Almacén'),
    ('Mayonesa común',                  'Mayonesa',                 'Almacén'),
    ('Mermelada de durazno',            'Mermelada de durazno',     'Almacén'),
    ('Pan de molde lacteado',           'Pan de molde',             'Almacén'),
    ('Pan flauta',                      'Pan flauta',               'Almacén'),
    ('Pulpa de tomate',                 'Pulpa de tomate',          'Almacén'),
    ('Sal fina yodada fluorada',        'Sal fina',                 'Almacén'),
    ('Té negro en saquitos',            'Té negro en saquitos',     'Almacén'),
    ('Yerba mate común',                'Yerba mate',               'Almacén'),
    -- Lácteos y huevos
    ('Dulce de leche',                  'Dulce de leche',           'Lácteos y huevos'),
    ('Helado familiar',                 'Helado',                   'Lácteos y huevos'),
    ('Huevos colorados',                'Huevos',                   'Lácteos y huevos'),
    ('Manteca',                         'Manteca',                  'Lácteos y huevos'),
    ('Margarina',                       'Margarina',                'Lácteos y huevos'),
    ('Queso rallado',                   'Queso rallado',            'Lácteos y huevos'),
    ('Yogur',                           'Yogur',                    'Lácteos y huevos'),
    -- Carnes y fiambres
    ('Aguja vacuna',                    'Aguja vacuna',             'Carnes y fiambres'),
    ('Carne picada vacuna',             'Carne picada',             'Carnes y fiambres'),
    ('Chorizos mezcla',                 'Chorizos',                 'Carnes y fiambres'),
    ('Frankfurters cortos',             'Frankfurters',             'Carnes y fiambres'),
    ('Hamburguesas carne vacun',        'Hamburguesas de carne',    'Carnes y fiambres'),
    ('Jamón cocido no artesanal',       'Jamón cocido',             'Carnes y fiambres'),
    ('Leonesa',                         'Leonesa',                  'Carnes y fiambres'),
    ('Nalga vacuna',                    'Nalga vacuna',             'Carnes y fiambres'),
    ('Paleta vacuna',                   'Paleta vacuna',            'Carnes y fiambres'),
    ('Peceto vacuno',                   'Peceto',                   'Carnes y fiambres'),
    ('Pescado fresco',                  'Pescado fresco',           'Carnes y fiambres'),
    ('Pollo entero fresco con menudos', 'Pollo entero',             'Carnes y fiambres'),
    ('Rueda Vacuna',                    'Rueda vacuna',             'Carnes y fiambres'),
    -- Frutas
    ('Banana Brasil',                   'Banana',                   'Frutas'),
    ('Banana Ecuador',                  'Banana',                   'Frutas'),
    ('Ciruela Blanca',                  'Ciruela',                  'Frutas'),
    ('Ciruela Roja',                    'Ciruela',                  'Frutas'),
    ('Durazno Pavía',                   'Durazno',                  'Frutas'),
    ('Durazno Rey del Monte',           'Durazno',                  'Frutas'),
    ('Frutilla',                        'Frutilla',                 'Frutas'),
    ('Kiwi Chile',                      'Kiwi',                     'Frutas'),
    ('Kiwi Nueva Zelanda',              'Kiwi',                     'Frutas'),
    ('Limón',                           'Limón',                    'Frutas'),
    ('Mandarina Avana',                 'Mandarina',                'Frutas'),
    ('Mandarina Común',                 'Mandarina',                'Frutas'),
    ('Mandarina Ellendale',             'Mandarina',                'Frutas'),
    ('Mandarina Zazuma',                'Mandarina',                'Frutas'),
    ('Manzana Fuji',                    'Manzana',                  'Frutas'),
    ('Manzana Granny Smith',            'Manzana',                  'Frutas'),
    ('Manzana Red Chieff',              'Manzana',                  'Frutas'),
    ('Manzana Red Deliciosa',           'Manzana',                  'Frutas'),
    ('Manzana Roja',                    'Manzana',                  'Frutas'),
    ('Manzana Royal Gala',              'Manzana',                  'Frutas'),
    ('Melón Amarillo',                  'Melón',                    'Frutas'),
    ('Melón Escrito',                   'Melón',                    'Frutas'),
    ('Melón Orange',                    'Melón',                    'Frutas'),
    ('Melón Piel de Sapo',              'Melón',                    'Frutas'),
    ('Melón Reticulado',                'Melón',                    'Frutas'),
    ('Naranja Navel',                   'Naranja',                  'Frutas'),
    ('Naranja Valencia',                'Naranja',                  'Frutas'),
    ('Pera Francesa',                   'Pera',                     'Frutas'),
    ('Pera Packams',                    'Pera',                     'Frutas'),
    ('Pera Williams',                   'Pera',                     'Frutas'),
    ('Pomelo Blanco',                   'Pomelo',                   'Frutas'),
    ('Pomelo Rojo',                     'Pomelo',                   'Frutas'),
    ('Sandía',                          'Sandía',                   'Frutas'),
    ('Uva Blanca',                      'Uva',                      'Frutas'),
    ('Uva Moscatel',                    'Uva',                      'Frutas'),
    ('Uva Negra',                       'Uva',                      'Frutas'),
    ('Uva Rosada',                      'Uva',                      'Frutas'),
    -- Verduras
    ('Acelga',                          'Acelga',                   'Verduras'),
    ('Berenjena Violeta',               'Berenjena',                'Verduras'),
    ('Berro',                           'Berro',                    'Verduras'),
    ('Boniato Arapery',                 'Boniato',                  'Verduras'),
    ('Boniato Morado',                  'Boniato',                  'Verduras'),
    ('Brócoli',                         'Brócoli',                  'Verduras'),
    ('Cebolla de Verdeo',               'Cebolla de verdeo',        'Verduras'),
    ('Cebolla Seca',                    'Cebolla',                  'Verduras'),
    ('Chaucha',                         'Chaucha',                  'Verduras'),
    ('Choclo',                          'Choclo',                   'Verduras'),
    ('Coliflor',                        'Coliflor',                 'Verduras'),
    ('Espinaca',                        'Espinaca',                 'Verduras'),
    ('Lechuga Crespa',                  'Lechuga',                  'Verduras'),
    ('Lechuga Mantecosa',               'Lechuga',                  'Verduras'),
    ('Morrón Amarillo',                 'Morrón',                   'Verduras'),
    ('Morrón Rojo',                     'Morrón',                   'Verduras'),
    ('Morrón Verde',                    'Morrón',                   'Verduras'),
    ('Nabo',                            'Nabo',                     'Verduras'),
    ('Papa Blanca',                     'Papa',                     'Verduras'),
    ('Papa Rosada',                     'Papa',                     'Verduras'),
    ('Pepino',                          'Pepino',                   'Verduras'),
    ('Puerro',                          'Puerro',                   'Verduras'),
    ('Rabanito',                        'Rabanito',                 'Verduras'),
    ('Remolacha',                       'Remolacha',                'Verduras'),
    ('Repollo Blanco',                  'Repollo',                  'Verduras'),
    ('Repollo Colorado',                'Repollo',                  'Verduras'),
    ('Repollo Crespo',                  'Repollo',                  'Verduras'),
    ('Tomate Americano',                'Tomate',                   'Verduras'),
    ('Tomate Perita',                   'Tomate',                   'Verduras'),
    ('Zanahoria',                       'Zanahoria',                'Verduras'),
    ('Zapallito Redondo',               'Zapallito',                'Verduras'),
    ('Zapallito Zuchini',               'Zapallito',                'Verduras'),
    ('Zapallo Calabacín',               'Zapallo',                  'Verduras'),
    ('Zapallo Criollo',                 'Zapallo',                  'Verduras'),
    ('Zapallo Kabutiá',                 'Zapallo',                  'Verduras'),
    -- Bebidas
    ('Agua de mesa con gas',            'Agua con gas',             'Bebidas'),
    ('Agua de mesa sin gas',            'Agua sin gas',             'Bebidas'),
    ('Agua en bidón',                   'Agua en bidón',            'Bebidas'),
    ('Cerveza',                         'Cerveza',                  'Bebidas'),
    ('Gaseosa tipo cola (env. no ret.)', 'Gaseosa cola',            'Bebidas'),
    ('Vino tinto común tetrabrick',     'Vino tinto',               'Bebidas'),
    -- Limpieza
    ('Detergente para vajilla',         'Detergente para vajilla',  'Limpieza'),
    ('Hipoclorito de sodio',            'Hipoclorito de sodio',     'Limpieza'),
    ('Jabón en polvo máquina',          'Jabón en polvo',           'Limpieza'),
    ('Jabón para ropa en barra',        'Jabón en barra para ropa', 'Limpieza'),
    -- Higiene personal
    ('Afeitadora',                      'Afeitadora',               'Higiene personal'),
    ('Champú',                          'Champú',                   'Higiene personal'),
    ('Colonia + Talco',                 'Colonia y talco',          'Higiene personal'),
    ('Crema facial',                    'Crema facial',             'Higiene personal'),
    ('Desodorante en aerosol',          'Desodorante en aerosol',   'Higiene personal'),
    ('Jabón de glicerina',              'Jabón de glicerina',       'Higiene personal'),
    ('Jabón de tocador',                'Jabón de tocador',         'Higiene personal'),
    ('Pañales',                         'Pañales',                  'Higiene personal'),
    ('Pañales adultos',                 'Pañales para adultos',     'Higiene personal'),
    ('Papel higiénico hoja simple',     'Papel higiénico',          'Higiene personal'),
    ('Pasta dental',                    'Pasta dental',             'Higiene personal'),
    ('Perfume',                         'Perfume',                  'Higiene personal'),
    ('Talco',                           'Talco',                    'Higiene personal'),
    ('Toallitas femeninas',             'Toallitas femeninas',      'Higiene personal'),
    -- Farmacia y cuidado
    ('Agua oxigenada 10 volumen',       'Agua oxigenada',           'Farmacia y cuidado'),
    ('Alcohol en gel',                  'Alcohol en gel',           'Farmacia y cuidado'),
    ('Alcohol rectificado',             'Alcohol',                  'Farmacia y cuidado'),
    ('Algodón',                         'Algodón',                  'Farmacia y cuidado'),
    ('Apositos',                        'Apósitos',                 'Farmacia y cuidado'),
    ('Curitas',                         'Curitas',                  'Farmacia y cuidado'),
    ('Gasa estéril',                    'Gasa estéril',             'Farmacia y cuidado'),
    ('Protector solar SPF 20',          'Protector solar',          'Farmacia y cuidado'),
    ('Protector solar SPF 30',          'Protector solar',          'Farmacia y cuidado'),
    ('Protector solar SPF 40',          'Protector solar',          'Farmacia y cuidado'),
    ('Protector solar SPF 50',          'Protector solar',          'Farmacia y cuidado'),
    ('Protector solar SPF 60',          'Protector solar',          'Farmacia y cuidado'),
    ('Protector solar SPF 80',          'Protector solar',          'Farmacia y cuidado'),
    ('Repelente aerosol',               'Repelente en aerosol',     'Farmacia y cuidado'),
    ('Repelente spray',                 'Repelente en aerosol',     'Farmacia y cuidado'),
    ('Repelente crema',                 'Repelente en crema o gel', 'Farmacia y cuidado'),
    ('Repelente gel',                   'Repelente en crema o gel', 'Farmacia y cuidado'),
    -- Útiles escolares
    ('Barra Adhesiva',                  'Barra adhesiva',           'Útiles escolares'),
    ('Bolígrafo',                       'Bolígrafo',                'Útiles escolares'),
    ('Carpeta',                         'Carpeta',                  'Útiles escolares'),
    ('Cascola',                         'Cascola',                  'Útiles escolares'),
    ('Cinta adhesiva',                  'Cinta adhesiva',           'Útiles escolares'),
    ('Compás',                          'Compás',                   'Útiles escolares'),
    ('Crayolas',                        'Crayolas',                 'Útiles escolares'),
    ('Crayolas/Pasteles',               'Crayolas',                 'Útiles escolares'),
    ('Cuadernola',                      'Cuadernola',               'Útiles escolares'),
    ('Cuadernola Tapa Dura',            'Cuadernola',               'Útiles escolares'),
    ('Cuaderno Rayado',                 'Cuaderno rayado',          'Útiles escolares'),
    ('Cuaderno Rayado Espiral',         'Cuaderno rayado',          'Útiles escolares'),
    ('Goma',                            'Goma de borrar',           'Útiles escolares'),
    ('Hojas',                           'Hojas',                    'Útiles escolares'),
    ('Hojas cuadriculadas',             'Hojas cuadriculadas',      'Útiles escolares'),
    ('Hojas de Garbanzo',               'Hojas de garbanzo',        'Útiles escolares'),
    ('Hojas de Blancas',                'Hojas blancas',            'Útiles escolares'),  -- nombre de 2026
    ('Juego de Geometría',              'Juego de geometría',       'Útiles escolares'),
    ('Lápices de colores',              'Lápices de colores',       'Útiles escolares'),
    ('Lápiz Corrector',                 'Corrector',                'Útiles escolares'),
    ('Lápiz Negro',                     'Lápiz negro',              'Útiles escolares'),
    ('Libreta',                         'Libreta',                  'Útiles escolares'),
    ('Marcador flúor',                  'Marcador flúor',           'Útiles escolares'),
    ('Marcadores flúor',                'Marcador flúor',           'Útiles escolares'),
    ('Marcadores delgados',             'Marcadores delgados',      'Útiles escolares'),
    ('Marcadores gruesos',              'Marcadores gruesos',       'Útiles escolares'),
    ('Moña',                            'Moña',                     'Útiles escolares'),
    ('Pincel',                          'Pincel',                   'Útiles escolares'),
    ('Regla 30 CM',                     'Regla 30 cm',              'Útiles escolares'),
    ('Sacapuntas',                      'Sacapuntas',               'Útiles escolares'),
    ('Tempera',                         'Témperas',                 'Útiles escolares'),
    ('Temperas',                        'Témperas',                 'Útiles escolares'),
    ('Tijera',                          'Tijera',                   'Útiles escolares'),
    ('Tinta',                           'Tinta',                    'Útiles escolares'),
    ('Túnica',                          'Túnica',                   'Útiles escolares');

-- Productos del SIPC con su genérico y su unidad base
CREATE TEMP TABLE sipc_con_generico ON COMMIT DROP AS
SELECT pf.id AS producto_fuente_id,
       c.generico,
       c.categoria,
       core.unidad_base(pf.unidad) AS unidad_base
FROM core.producto_fuente pf
JOIN core.fuente f      ON f.id = pf.fuente_id AND f.codigo = 'sipc'
JOIN correspondencia c  ON c.tipo_sipc = trim(pf.tipo);   -- trim: algunos tipos traen espacios

-- 1. Genéricos: uno por nombre, en la unidad base más frecuente de sus productos
INSERT INTO core.producto_canonico (nombre, categoria, cantidad_base, unidad_base)
SELECT generico, min(categoria), 1, mode() WITHIN GROUP (ORDER BY unidad_base)
FROM sipc_con_generico
WHERE unidad_base IS NOT NULL
GROUP BY generico
ON CONFLICT (nombre, cantidad_base, unidad_base) DO UPDATE SET categoria = EXCLUDED.categoria;

-- 2. Vínculos: se rehacen los del SIPC hechos por regla (los revisados a mano se respetan)
DELETE FROM core.match_producto m
USING core.producto_fuente pf, core.fuente f
WHERE pf.id = m.producto_fuente_id AND pf.fuente_id = f.id
  AND f.codigo = 'sipc' AND m.metodo = 'regla' AND NOT m.revisado;

INSERT INTO core.match_producto (producto_fuente_id, producto_canonico_id, metodo, confianza)
SELECT s.producto_fuente_id, pc.id, 'regla', 1
FROM sipc_con_generico s
JOIN core.producto_canonico pc
  ON pc.nombre = s.generico AND pc.cantidad_base = 1 AND pc.unidad_base = s.unidad_base
ON CONFLICT (producto_fuente_id) DO NOTHING;
