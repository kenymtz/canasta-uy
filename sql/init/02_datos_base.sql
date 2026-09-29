-- Datos de referencia mínimos para arrancar.

INSERT INTO core.pais (codigo, nombre, moneda) VALUES
    ('UY', 'Uruguay',   'UYU'),
    ('AR', 'Argentina', 'ARS'),
    ('BR', 'Brasil',    'BRL');

INSERT INTO core.par_frontera (ciudad_uy, ciudad_vecina, pais_vecino, tipo) VALUES
    ('Rivera',      'Santana do Livramento', 'BR', 'seca'),
    ('Chuy',        'Chuí',                  'BR', 'seca'),
    ('Aceguá',      'Aceguá',                'BR', 'seca'),
    ('Artigas',     'Quaraí',                'BR', 'puente'),
    ('Río Branco',  'Jaguarão',              'BR', 'puente'),
    ('Bella Unión', 'Barra do Quaraí',       'BR', 'puente'),
    ('Salto',       'Concordia',             'AR', 'represa'),
    ('Paysandú',    'Colón',                 'AR', 'puente'),
    ('Fray Bentos', 'Gualeguaychú',          'AR', 'puente');

INSERT INTO core.fuente (codigo, nombre, pais, tipo, licencia, url) VALUES
    ('sipc',        'Sistema de Información de Precios al Consumidor (MEF)', 'UY', 'oficial',
        NULL, 'https://catalogodatos.gub.uy/dataset/?tags=Precios'),
    ('sepa',        'Precios Claros - Base SEPA',                            'AR', 'oficial',
        'CC BY 4.0', 'https://datos.produccion.gob.ar/dataset/sepa-precios'),
    ('nfce_rs',     'NFC-e (QR del ticket, SEFAZ-RS)',                        'BR', 'ticket',
        NULL, 'https://www.sefaz.rs.gov.br'),
    ('ticket_foto', 'Ticket fotografiado (extracción con IA)',               NULL, 'ticket',
        NULL, NULL),
    ('manual',      'Carga manual',                                          NULL, 'manual',
        NULL, NULL);
