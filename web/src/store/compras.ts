import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { combinar, type Compra, faltanEnLaCuenta } from "../lib/compras";
import { nube, type Usuario } from "../lib/nube";

interface EstadoCompras {
  compras: Compra[];
  /** Con sesión iniciada, cada cambio se copia también a la cuenta */
  usuario: Usuario | null;
  sincronizando: boolean;
  errorNube: string | null;
  /** Devuelve false si ese ticket ya estaba guardado (no se duplica). */
  guardar: (compra: Compra) => boolean;
  borrar: (id: string) => void;
  /** Al iniciar sesión (o abrir la web con la sesión abierta): sube lo que falta y trae lo de la cuenta. */
  entrar: (usuario: Usuario) => Promise<void>;
  /** Al cerrar sesión, el historial se quita del teléfono (queda en la cuenta). */
  salir: () => void;
}

// localStorage no existe fuera del navegador (por ejemplo, en los tests)
const almacenamiento = createJSONStorage(() =>
  typeof localStorage !== "undefined"
    ? localStorage
    : { getItem: () => null, setItem: () => {}, removeItem: () => {} },
);

/**
 * "Mis compras". Siempre se guardan en este navegador (así andan sin conexión y sin cuenta);
 * con sesión iniciada, además, en la cuenta. Aparte de la canasta (otra clave) para que
 * borrar una no toque la otra.
 */
export const useCompras = create<EstadoCompras>()(
  persist(
    (set, get) => ({
      compras: [],
      usuario: null,
      sincronizando: false,
      errorNube: null,

      guardar: (compra) => {
        if (get().compras.some((c) => c.id === compra.id)) return false;
        set(({ compras }) => ({ compras: [...compras, compra] }));
        // Si falla (sin conexión, por ejemplo), se vuelve a intentar en la próxima sincronización
        if (get().usuario) nube.subirCompras([compra]).catch(() => {});
        return true;
      },

      borrar: (id) => {
        set(({ compras }) => ({ compras: compras.filter((c) => c.id !== id) }));
        if (get().usuario) {
          nube.borrarCompra(id).catch((e: Error) => set({ errorNube: e.message }));
        }
      },

      entrar: async (usuario) => {
        set({ usuario, sincronizando: true, errorNube: null });
        try {
          const deLaCuenta = await nube.traerCompras();
          const locales = get().compras;
          await nube.subirCompras(faltanEnLaCuenta(locales, deLaCuenta));
          set({ compras: combinar(get().compras, deLaCuenta) });
        } catch (e) {
          set({ errorNube: (e as Error).message });
        } finally {
          set({ sincronizando: false });
        }
      },

      salir: () => set({ usuario: null, compras: [], errorNube: null }),
    }),
    {
      name: "canasta-uy-compras",
      storage: almacenamiento,
      version: 1,
      // Solo las compras se guardan en el navegador; la sesión la maneja Supabase
      partialize: ({ compras }) => ({ compras }),
    },
  ),
);
