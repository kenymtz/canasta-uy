-- Prueba local de las reglas de 01_compras.sql, sin Supabase: se imita lo mínimo de Supabase
-- (el esquema auth, auth.uid() y los roles anon y authenticated) en una base descartable.
--
--   docker exec pf-postgres createdb -U precios prueba_supabase
--   docker exec -i pf-postgres psql -U precios -d prueba_supabase -v ON_ERROR_STOP=1 \
--       < sql/supabase/prueba_rls.sql      (desde la raíz del repo; incluye 01_compras.sql)
--   docker exec pf-postgres dropdb -U precios prueba_supabase
--
-- Termina con "PRUEBA OK" o se corta en la primera regla que no se cumple.

\set QUIET on
\set ON_ERROR_STOP on

-- ─── Lo mínimo de Supabase ───────────────────────────────────────────────────
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $$;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
-- En Supabase, auth.uid() lee el usuario del token del pedido; acá, de una variable
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
    AS $$ SELECT nullif(current_setting('prueba.usuario', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
INSERT INTO auth.users VALUES
    ('aaaaaaaa-0000-0000-0000-000000000000'),   -- Ana
    ('bbbbbbbb-0000-0000-0000-000000000000');   -- Beto

\ir 01_compras.sql

-- ─── Ana guarda una compra ───────────────────────────────────────────────────
SET ROLE authenticated;
SET prueba.usuario = 'aaaaaaaa-0000-0000-0000-000000000000';
INSERT INTO public.compra (ticket_id, fecha, total, ruc, productos)
VALUES ('cfe-219999990019-e-Ticket-A-1', '2026-09-30', 437, '219999990019',
        '[{"descripcion": "ACEITE GIRASOL 900ML", "precio": 79}]');

DO $$ BEGIN
    ASSERT (SELECT count(*) FROM public.compra) = 1, 'Ana tiene que ver su compra';
END $$;

-- El mismo ticket otra vez: lo rechaza la restricción UNIQUE
DO $$ BEGIN
    INSERT INTO public.compra (ticket_id, fecha, total) VALUES ('cfe-219999990019-e-Ticket-A-1', '2026-09-30', 437);
    RAISE EXCEPTION 'se guardó dos veces el mismo ticket';
EXCEPTION WHEN unique_violation THEN NULL;
END $$;

-- ─── Beto no ve, no borra y no puede guardar a nombre de Ana ─────────────────
SET prueba.usuario = 'bbbbbbbb-0000-0000-0000-000000000000';
DO $$ BEGIN
    ASSERT (SELECT count(*) FROM public.compra) = 0, 'Beto ve compras de Ana';
END $$;
DELETE FROM public.compra;  -- no falla: simplemente no encuentra filas suyas
DO $$ BEGIN
    INSERT INTO public.compra (usuario_id, ticket_id, fecha, total)
    VALUES ('aaaaaaaa-0000-0000-0000-000000000000', 'falsa', '2026-09-30', 1);
    RAISE EXCEPTION 'Beto guardó una compra a nombre de Ana';
EXCEPTION WHEN insufficient_privilege THEN NULL;  -- "new row violates row-level security policy"
END $$;
DO $$ BEGIN
    UPDATE public.compra SET total = 0;
    RAISE EXCEPTION 'se pudo editar una compra';
EXCEPTION WHEN insufficient_privilege THEN NULL;  -- no hay permiso de UPDATE
END $$;

-- ─── Un visitante sin sesión no puede ni mirar la tabla ──────────────────────
RESET ROLE;
SET ROLE anon;
RESET prueba.usuario;
DO $$ BEGIN
    PERFORM count(*) FROM public.compra;
    RAISE EXCEPTION 'un visitante sin sesión pudo leer la tabla';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
DO $$ BEGIN
    PERFORM public.borrar_mi_cuenta();
    RAISE EXCEPTION 'un visitante sin sesión pudo llamar a borrar_mi_cuenta';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

-- ─── Ana sigue teniendo su compra y después borra su cuenta ──────────────────
RESET ROLE;
SET ROLE authenticated;
SET prueba.usuario = 'aaaaaaaa-0000-0000-0000-000000000000';
DO $$ BEGIN
    ASSERT (SELECT count(*) FROM public.compra) = 1, 'el DELETE de Beto borró la compra de Ana';
END $$;
SELECT public.borrar_mi_cuenta();

RESET ROLE;
DO $$ BEGIN
    ASSERT NOT EXISTS (SELECT 1 FROM auth.users WHERE id = 'aaaaaaaa-0000-0000-0000-000000000000'), 'Ana sigue existiendo';
    ASSERT (SELECT count(*) FROM public.compra) = 0, 'quedaron compras de Ana';
    ASSERT EXISTS (SELECT 1 FROM auth.users WHERE id = 'bbbbbbbb-0000-0000-0000-000000000000'), 'se borró a Beto';
END $$;

\echo PRUEBA OK
