import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { Generico } from "../lib/api";
import { CANASTA_BASICA } from "../lib/canastaBasica";
import { cantidadInicial, paso } from "../lib/pasos";

export interface Ubicacion {
  departamento: string;
  ciudad: string;
  lat: number;
  lon: number;
}

interface EstadoCanasta {
  ubicacion: Ubicacion | null;
  radioKm: number;
  /** producto_canonico_id → cantidad en la unidad base */
  items: Record<number, number>;
  presupuesto: number | null;
  elegirUbicacion: (u: Ubicacion) => void;
  setRadio: (km: number) => void;
  sumar: (g: Generico) => void;
  restar: (g: Generico) => void;
  cargarBasica: (genericos: Generico[]) => void;
  vaciar: () => void;
  setPresupuesto: (monto: number | null) => void;
}

// Evita arrastrar errores de coma flotante (0,1 + 0,2 = 0,30000000000000004)
const redondear = (n: number) => Math.round(n * 1000) / 1000;

// localStorage no existe fuera del navegador (por ejemplo, en los tests)
const almacenamiento = createJSONStorage(() =>
  typeof localStorage !== "undefined"
    ? localStorage
    : { getItem: () => null, setItem: () => {}, removeItem: () => {} },
);

export const useCanasta = create<EstadoCanasta>()(
  persist(
    (set) => ({
      ubicacion: null,
      radioKm: 5,
      items: {},
      presupuesto: null,

      elegirUbicacion: (ubicacion) => set({ ubicacion }),
      setRadio: (radioKm) => set({ radioKm }),

      sumar: (g) =>
        set(({ items }) => {
          const actual = items[g.producto_canonico_id];
          const nueva = actual === undefined ? cantidadInicial(g) : actual + paso(g);
          return { items: { ...items, [g.producto_canonico_id]: redondear(nueva) } };
        }),

      restar: (g) =>
        set(({ items }) => {
          const actual = items[g.producto_canonico_id];
          if (actual === undefined) return {};
          const nueva = redondear(actual - paso(g));
          const resto = { ...items };
          if (nueva <= 0) delete resto[g.producto_canonico_id];
          else resto[g.producto_canonico_id] = nueva;
          return { items: resto };
        }),

      cargarBasica: (genericos) =>
        set(() => {
          const porNombre = new Map(genericos.map((g) => [g.nombre, g]));
          const items: Record<number, number> = {};
          for (const [nombre, cantidad] of CANASTA_BASICA) {
            const g = porNombre.get(nombre);
            if (g) items[g.producto_canonico_id] = cantidad;
          }
          return { items };
        }),

      vaciar: () => set({ items: {} }),
      setPresupuesto: (monto) => set({ presupuesto: monto && monto > 0 ? monto : null }),
    }),
    { name: "canasta-uy", storage: almacenamiento },
  ),
);
