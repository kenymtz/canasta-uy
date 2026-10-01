-- Cuentas de usuario de Canasta UY (Supabase): el historial de compras de cada usuario.
--
-- Va en el proyecto de Supabase, no en el Postgres local: se pega en SQL Editor y se corre
-- una vez. Supabase ya trae el esquema auth (usuarios, sesiones) y la función auth.uid(),
-- que devuelve el id del usuario que hizo el pedido.
--
-- La web habla con esta tabla directamente desde el navegador, con la clave pública. Lo que
-- impide que alguien lea o toque compras ajenas es Row Level Security: las reglas (policies)
-- de abajo filtran cada fila por su dueño, dentro de la base, sin importar qué pida la web.

CREATE TABLE public.compra (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Si se borra el usuario, se borran sus compras (ON DELETE CASCADE)
    usuario_id uuid        NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
    -- El id que arma la web: el número del comprobante si hubo QR (ver web/src/lib/compras.ts)
    ticket_id  text        NOT NULL,
    fecha      date        NOT NULL,
    total      numeric(12, 2) NOT NULL CHECK (total >= 0),
    ruc        text        CHECK (ruc ~ '^\d{12}$'),
    -- {establecimiento_id, nombre, direccion, ciudad} del SIPC, o null si no lo marcó
    comercio   jsonb,
    -- [{descripcion, precio}], ya sin datos personales (los borra el navegador antes)
    productos  jsonb       NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(productos) = 'array'),
    guardada   timestamptz NOT NULL DEFAULT now(),
    -- El mismo ticket no se guarda dos veces para el mismo usuario
    UNIQUE (usuario_id, ticket_id)
);

CREATE INDEX ON public.compra (usuario_id, fecha DESC);

ALTER TABLE public.compra ENABLE ROW LEVEL SECURITY;

-- Una regla por acción. "authenticated" son los usuarios con sesión iniciada; los visitantes
-- sin sesión (anon) no tienen ninguna regla, así que no ven nada.
CREATE POLICY "ver mis compras" ON public.compra
    FOR SELECT TO authenticated USING (usuario_id = (SELECT auth.uid()));
CREATE POLICY "guardar mis compras" ON public.compra
    FOR INSERT TO authenticated WITH CHECK (usuario_id = (SELECT auth.uid()));
CREATE POLICY "borrar mis compras" ON public.compra
    FOR DELETE TO authenticated USING (usuario_id = (SELECT auth.uid()));

-- Además de las reglas, el permiso de usar la tabla (el proyecto se creó sin exponer las
-- tablas solas). No hay UPDATE: una compra se guarda o se borra, no se edita.
GRANT SELECT, INSERT, DELETE ON public.compra TO authenticated;


-- ─── Borrar la cuenta ─────────────────────────────────────────────────────────

-- Borra al usuario que la llama y, en cascada, todas sus compras. SECURITY DEFINER: corre
-- con los permisos de quien la creó (el dueño de la base), porque un usuario común no puede
-- tocar auth.users; por eso solo borra auth.uid() y nada más.
CREATE FUNCTION public.borrar_mi_cuenta()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    DELETE FROM auth.users WHERE id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.borrar_mi_cuenta() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.borrar_mi_cuenta() TO authenticated;
