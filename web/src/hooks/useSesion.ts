import { useEffect } from "react";

import { aUsuario, supabase } from "../lib/nube";
import { useCompras } from "../store/compras";

/**
 * Escucha la sesión de Supabase: al entrar (o al abrir la web con la sesión ya abierta)
 * sincroniza las compras; al salir, las quita del teléfono. Se usa una vez, en App.
 */
export function useSesion() {
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((evento, sesion) => {
      const usuario = aUsuario(sesion?.user);
      const { usuario: actual, entrar, salir } = useCompras.getState();
      // setTimeout: Supabase pide no llamar a la base dentro de este aviso (se trabaría)
      if (usuario && usuario.id !== actual?.id) setTimeout(() => entrar(usuario), 0);
      if (evento === "SIGNED_OUT" && actual) salir();
    });
    return () => data.subscription.unsubscribe();
  }, []);
}
