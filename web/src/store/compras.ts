import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { Compra } from "../lib/compras";

interface EstadoCompras {
  compras: Compra[];
  /** Devuelve false si ese ticket ya estaba guardado (no se duplica). */
  guardar: (compra: Compra) => boolean;
  borrar: (id: string) => void;
}

// localStorage no existe fuera del navegador (por ejemplo, en los tests)
const almacenamiento = createJSONStorage(() =>
  typeof localStorage !== "undefined"
    ? localStorage
    : { getItem: () => null, setItem: () => {}, removeItem: () => {} },
);

/**
 * "Mis compras", guardadas en este navegador. Aparte de la canasta (otra clave) para que
 * borrar una no toque la otra. Con las cuentas de usuario se van a sincronizar con la nube.
 */
export const useCompras = create<EstadoCompras>()(
  persist(
    (set, get) => ({
      compras: [],
      guardar: (compra) => {
        if (get().compras.some((c) => c.id === compra.id)) return false;
        set(({ compras }) => ({ compras: [...compras, compra] }));
        return true;
      },
      borrar: (id) => set(({ compras }) => ({ compras: compras.filter((c) => c.id !== id) })),
    }),
    { name: "canasta-uy-compras", storage: almacenamiento, version: 1 },
  ),
);
