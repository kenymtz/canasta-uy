-- Se ejecuta una sola vez, al crear el volumen de Postgres.

-- Base aparte para la configuración interna de Metabase
CREATE DATABASE metabase;

CREATE EXTENSION IF NOT EXISTS postgis;   -- geografía: comercios, distancias
CREATE EXTENSION IF NOT EXISTS vector;    -- pgvector: embeddings de productos
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- similitud de texto (matching por reglas)
CREATE EXTENSION IF NOT EXISTS unaccent;  -- normalizar "Leche Entera" / "leche éntera"

-- Capas del modelo de datos
CREATE SCHEMA IF NOT EXISTS raw;   -- datos tal cual llegan de cada fuente
CREATE SCHEMA IF NOT EXISTS core;  -- modelo limpio y canónico
CREATE SCHEMA IF NOT EXISTS mart;  -- vistas listas para dashboards y el bot
