-- Modelo de datos del núcleo (schema core).
-- Idea central: cada fuente trae SUS productos (producto_fuente) y un proceso de
-- matching los asocia a un producto_canonico común a los tres países.

-- ─── Referencias ──────────────────────────────────────────────────────────────

CREATE TABLE core.pais (
    codigo      char(2) PRIMARY KEY,           -- ISO 3166-1: UY, AR, BR
    nombre      text    NOT NULL,
    moneda      char(3) NOT NULL               -- ISO 4217: UYU, ARS, BRL
);

CREATE TABLE core.par_frontera (
    id              serial PRIMARY KEY,
    ciudad_uy       text    NOT NULL,
    ciudad_vecina   text    NOT NULL,
    pais_vecino     char(2) NOT NULL REFERENCES core.pais,
    tipo            text    NOT NULL CHECK (tipo IN ('seca', 'puente', 'represa')),
    UNIQUE (ciudad_uy, ciudad_vecina)
);

CREATE TABLE core.fuente (
    id          serial PRIMARY KEY,
    codigo      text    NOT NULL UNIQUE,       -- 'sipc', 'sepa', 'nfce_rs', 'ticket_foto'
    nombre      text    NOT NULL,
    pais        char(2) REFERENCES core.pais,  -- NULL si es multi-país
    tipo        text    NOT NULL CHECK (tipo IN ('oficial', 'ticket', 'manual')),
    licencia    text,
    url         text
);

-- ─── Comercios ────────────────────────────────────────────────────────────────

CREATE TABLE core.establecimiento (
    id              bigserial PRIMARY KEY,
    fuente_id       int     NOT NULL REFERENCES core.fuente,
    id_externo      text    NOT NULL,          -- id del comercio en la fuente (o CNPJ)
    pais            char(2) NOT NULL REFERENCES core.pais,
    nombre          text    NOT NULL,
    cadena          text,
    direccion       text,
    ciudad          text,
    ubicacion       geography(Point, 4326),
    actualizado_en  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (fuente_id, id_externo)
);
CREATE INDEX ON core.establecimiento USING gist (ubicacion);

-- ─── Productos ────────────────────────────────────────────────────────────────

CREATE TABLE core.producto_canonico (
    id              bigserial PRIMARY KEY,
    nombre          text    NOT NULL,          -- "Leche entera"
    categoria       text,
    cantidad_base   numeric NOT NULL,          -- 1
    unidad_base     text    NOT NULL CHECK (unidad_base IN ('kg', 'l', 'unidad')),
    -- 768 dimensiones: tamaño recomendado para gemini-embedding con salida reducida.
    -- Si cambiás de modelo, ajustá esta dimensión.
    embedding       vector(768),
    UNIQUE (nombre, cantidad_base, unidad_base)
);
CREATE INDEX ON core.producto_canonico USING hnsw (embedding vector_cosine_ops);

CREATE TABLE core.producto_fuente (
    id                      bigserial PRIMARY KEY,
    fuente_id               int     NOT NULL REFERENCES core.fuente,
    id_externo              text    NOT NULL,  -- id en la fuente, EAN o código del ticket
    descripcion_original    text    NOT NULL,  -- "LEITE INTEGRAL PIRACANJUBA 1L"
    tipo                    text,              -- tipo sin marca según la fuente: "Aceite de girasol"
    marca                   text,
    ean                     text,
    cantidad                numeric,           -- 1000
    unidad                  text,              -- 'ml'
    embedding               vector(768),
    UNIQUE (fuente_id, id_externo)
);
CREATE INDEX ON core.producto_fuente USING gin (descripcion_original gin_trgm_ops);

-- Resultado del matching producto_fuente → producto_canonico
CREATE TABLE core.match_producto (
    producto_fuente_id      bigint  PRIMARY KEY REFERENCES core.producto_fuente ON DELETE CASCADE,
    producto_canonico_id    bigint  NOT NULL REFERENCES core.producto_canonico,
    metodo                  text    NOT NULL CHECK (metodo IN ('ean', 'regla', 'embedding', 'manual')),
    confianza               numeric(4, 3) NOT NULL CHECK (confianza BETWEEN 0 AND 1),
    revisado                boolean NOT NULL DEFAULT false,
    creado_en               timestamptz NOT NULL DEFAULT now()
);

-- ─── Precios y cambio ─────────────────────────────────────────────────────────

-- La PK hace idempotente la carga diaria: volver a cargar el mismo día no duplica.
CREATE TABLE core.precio (
    fecha                   date    NOT NULL,
    establecimiento_id      bigint  NOT NULL REFERENCES core.establecimiento,
    producto_fuente_id      bigint  NOT NULL REFERENCES core.producto_fuente,
    precio                  numeric(14, 2) NOT NULL CHECK (precio > 0),
    moneda                  char(3) NOT NULL,
    es_oferta               boolean NOT NULL DEFAULT false,
    PRIMARY KEY (fecha, establecimiento_id, producto_fuente_id)
);
CREATE INDEX ON core.precio (producto_fuente_id, fecha DESC);

-- 'oficial' viene de BCU / BCB (PTAX) / BCRA; 'frontera' es el cambio real de casas
-- de cambio o comercios, que se carga a mano porque no hay fuente abierta.
CREATE TABLE core.tipo_cambio (
    fecha       date    NOT NULL,
    moneda      char(3) NOT NULL,              -- moneda local: UYU, ARS, BRL
    tipo        text    NOT NULL CHECK (tipo IN ('oficial', 'frontera')),
    por_usd     numeric(18, 6) NOT NULL CHECK (por_usd > 0),  -- unidades de moneda por 1 USD
    fuente      text    NOT NULL,
    PRIMARY KEY (fecha, moneda, tipo)
);

-- ─── Tickets ──────────────────────────────────────────────────────────────────

CREATE TABLE core.ticket (
    id                  bigserial PRIMARY KEY,
    origen              text    NOT NULL CHECK (origen IN ('nfce_qr', 'foto')),
    hash                text    NOT NULL UNIQUE,  -- evita cargar dos veces el mismo ticket
    pais                char(2) NOT NULL REFERENCES core.pais,
    establecimiento_id  bigint  REFERENCES core.establecimiento,
    fecha               timestamptz NOT NULL,
    total               numeric(14, 2),
    moneda              char(3) NOT NULL,
    cargado_en          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE core.ticket_item (
    ticket_id           bigint  NOT NULL REFERENCES core.ticket ON DELETE CASCADE,
    linea               int     NOT NULL,
    texto_original      text    NOT NULL,
    producto_fuente_id  bigint  REFERENCES core.producto_fuente,
    cantidad            numeric(12, 3) NOT NULL DEFAULT 1,
    precio_unitario     numeric(14, 2),
    precio_total        numeric(14, 2),
    PRIMARY KEY (ticket_id, linea)
);

-- ─── Reglas aduaneras (configurables) ─────────────────────────────────────────

-- Los límites de franquicia cambian: se cargan con su fuente y vigencia,
-- nunca se escriben fijos en el código.
CREATE TABLE core.franquicia_aduanera (
    id              serial PRIMARY KEY,
    pais_compra     char(2) NOT NULL REFERENCES core.pais,
    pais_ingreso    char(2) NOT NULL REFERENCES core.pais,
    descripcion     text    NOT NULL,
    monto_usd       numeric(12, 2),
    vigente_desde   date    NOT NULL,
    vigente_hasta   date,
    fuente_url      text    NOT NULL
);
