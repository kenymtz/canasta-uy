import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { Generico } from "../lib/api";
import { cantidadInicial, paso } from "../lib/pasos";

export interface Ubicacion {
  departamento: string;
  ciudad: string;
  lat: number;
  lon: number;
}

/** Una compra que el usuario guardó para cargarla con un toque. */
export interface Lista {
  nombre: string;
  items: Record<number, number>;
  guardada: string; // fecha ISO
}

interface EstadoCanasta {
  ubicacion: Ubicacion | null;
  radioKm: number;
  /** producto_canonico_id → cantidad en la unidad base */
  items: Record<number, number>;
  presupuesto: number | null;
  listas: Lista[];
  elegirUbicacion: (u: Ubicacion) => void;
  setRadio: (km: number) => void;
  sumar: (g: Generico) => void;
  restar: (g: Generico) => void;
  /** Guarda la canasta actual; si ya hay una lista con ese nombre, la actualiza. */
  guardarLista: (nombre: string) => void;
  cargarLista: (nombre: string) => void;
  borrarLista: (nombre: string) => void;
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
      listas: [],

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

      guardarLista: (nombre) =>
        set(({ items, listas }) => {
          const limpio = nombre.trim();
          if (!limpio || Object.keys(items).length === 0) return {};
          const nueva: Lista = { nombre: limpio, items: { ...items }, guardada: new Date().toISOString() };
          const otras = listas.filter((l) => l.nombre !== limpio);
          return { listas: [nueva, ...otras] }; // la más reciente primero
        }),

      cargarLista: (nombre) =>
        set(({ listas }) => {
          const lista = listas.find((l) => l.nombre === nombre);
          return lista ? { items: { ...lista.items } } : {};
        }),

      borrarLista: (nombre) => set(({ listas }) => ({ listas: listas.filter((l) => l.nombre !== nombre) })),

      vaciar: () => set({ items: {} }),
      setPresupuesto: (monto) => set({ presupuesto: monto && monto > 0 ? monto : null }),
    }),
    {
      name: "canasta-uy",
      storage: almacenamiento,
      // Versión 1 agrega las listas guardadas; lo guardado antes sigue valiendo
      version: 1,
      migrate: (guardado) => ({ listas: [], ...(guardado as object) }) as unknown as EstadoCanasta,
    },
  ),
);
