// Cuentas de usuario y compras en la nube (Supabase). Opcional: sin sesión, todo sigue
// funcionando con lo guardado en el navegador.
//
// La URL y la clave son públicas a propósito (van en la web, cualquiera las ve). Lo que
// protege los datos son las reglas de la base: cada usuario solo puede ver, guardar y borrar
// sus propias compras (ver sql/supabase/01_compras.sql).

import { createClient, type User } from "@supabase/supabase-js";

import type { Compra } from "./compras";

const URL_SUPABASE = "https://cbabonwbwvzpkisgmusn.supabase.co";
const CLAVE_PUBLICA = "sb_publishable_xQeWmbE2tMxHZ4aVd9l2Gw_7uUXtM8j";

export const supabase = createClient(URL_SUPABASE, CLAVE_PUBLICA, {
  // PKCE: al volver de Google, la web cambia un código de un solo uso por la sesión
  auth: { flowType: "pkce", persistSession: true, detectSessionInUrl: true },
});

export interface Usuario {
  id: string;
  email: string | null;
  nombre: string | null;
}

export function aUsuario(user: User | null | undefined): Usuario | null {
  if (!user) return null;
  const datos = user.user_metadata ?? {};
  return { id: user.id, email: user.email ?? null, nombre: (datos.full_name ?? datos.name ?? null) as string | null };
}

// Cómo se llama cada campo en la tabla public.compra
interface FilaCompra {
  ticket_id: string;
  fecha: string;
  total: number;
  ruc: string | null;
  comercio: Compra["comercio"];
  productos: Compra["productos"];
  guardada: string;
}

const aFila = (c: Compra): FilaCompra => ({
  ticket_id: c.id,
  fecha: c.fecha,
  total: c.total,
  ruc: c.ruc,
  comercio: c.comercio,
  productos: c.productos,
  guardada: c.guardada,
});

const aCompra = (f: FilaCompra): Compra => ({
  id: f.ticket_id,
  fecha: f.fecha,
  total: Number(f.total),
  ruc: f.ruc,
  comercio: f.comercio,
  productos: f.productos ?? [],
  guardada: f.guardada,
});

export class ErrorNube extends Error {}

const DUPLICADA = "23505"; // código de Postgres para "viola una restricción UNIQUE"

export const nube = {
  entrarConGoogle: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      // Vuelve a esta misma web (en desarrollo, localhost; publicada, canastauy.pages.dev)
      options: { redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` },
    });
    if (error) throw new ErrorNube("No pudimos abrir el inicio de sesión con Google. Probá de nuevo.");
  },

  salir: async () => {
    await supabase.auth.signOut();
  },

  traerCompras: async (): Promise<Compra[]> => {
    const { data, error } = await supabase
      .from("compra")
      .select("ticket_id, fecha, total, ruc, comercio, productos, guardada")
      .order("fecha", { ascending: false });
    if (error) throw new ErrorNube("No pudimos traer tus compras de la cuenta.");
    return (data as FilaCompra[]).map(aCompra);
  },

  /** Sube compras; las que ya estaban en la cuenta (mismo ticket) se ignoran. */
  subirCompras: async (compras: Compra[]) => {
    if (compras.length === 0) return;
    const { error } = await supabase.from("compra").insert(compras.map(aFila));
    if (!error) return;
    // 23505: alguna ya estaba (UNIQUE usuario + ticket). Se sube de a una, salteando esas
    if (error.code !== DUPLICADA) throw new ErrorNube("No pudimos guardar tus compras en la cuenta.");
    for (const compra of compras) {
      const { error: e } = await supabase.from("compra").insert(aFila(compra));
      if (e && e.code !== DUPLICADA) throw new ErrorNube("No pudimos guardar tus compras en la cuenta.");
    }
  },

  borrarCompra: async (ticketId: string) => {
    const { error } = await supabase.from("compra").delete().eq("ticket_id", ticketId);
    if (error) throw new ErrorNube("No pudimos borrar la compra de tu cuenta.");
  },

  /** Borra la cuenta y, en la base, todas sus compras. */
  borrarCuenta: async () => {
    const { error } = await supabase.rpc("borrar_mi_cuenta");
    if (error) throw new ErrorNube("No pudimos borrar tu cuenta. Probá de nuevo.");
    await supabase.auth.signOut();
  },
};
