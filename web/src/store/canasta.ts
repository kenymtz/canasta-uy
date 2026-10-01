import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { Generico } from "../lib/api";
import { cantidadInicial, paso } from "../lib/pasos";
import { NOMBRES_VERSION_1 } from "./nombresVersion1";

export interface Ubicacion {
  departamento: string;
  ciudad: string;
  lat: number;
  lon: number;
}

/**
 * Nombre del genérico → cantidad en su unidad base. Se guarda por nombre y no por id: los ids
 * cambian cada vez que la base se arma de cero (la actualización mensual lo hace), los nombres no.
 */
export type Items = Record<string, number>;

/** Una compra que el usuario guardó para cargarla con un toque. */
export interface Lista {
  nombre: string;
  items: Items;
  guardada: string; // fecha ISO
}

interface EstadoCanasta {
  ubicacion: Ubicacion | null;
  radioKm: number;
  items: Items;
  presupuesto: number | null;
  listas: Lista[];
  elegirUbicacion: (u: Ubicacion) => void;
  setRadio: (km: number) => void;
  sumar: (g: Generico) => void;
  restar: (g: Generico) => void;
  /** Saca de la canasta productos que ya no tienen precios (las listas no se tocan). */
  quitar: (nombres: string[]) => void;
  /** Guarda la canasta actual; si ya hay una lista con ese nombre, la actualiza. */
  guardarLista: (nombre: string) => void;
  cargarLista: (nombre: string) => void;
  borrarLista: (nombre: string) => void;
  vaciar: () => void;
  setPresupuesto: (monto: number | null) => void;
}

// Evita arrastrar errores de coma flotante (0,1 + 0,2 = 0,30000000000000004)
const redondear = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Pasa lo guardado por versiones anteriores al formato actual.
 * Versión 0 → 1: se agregan las listas. Versión 1 → 2: los productos pasan de id a nombre.
 */
export function migrar(guardado: unknown, version: number): Partial<EstadoCanasta> {
  const estado = { listas: [], ...(guardado as object) } as Partial<EstadoCanasta>;
  if (version < 2) {
    const aNombres = (items: Items = {}): Items =>
      Object.fromEntries(
        Object.entries(items)
          .filter(([id]) => NOMBRES_VERSION_1[Number(id)])
          .map(([id, cantidad]) => [NOMBRES_VERSION_1[Number(id)], cantidad]),
      );
    estado.items = aNombres(estado.items);
    estado.listas = (estado.listas ?? []).map((l) => ({ ...l, items: aNombres(l.items) }));
  }
  return estado;
}

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
          const actual = items[g.nombre];
          const nueva = actual === undefined ? cantidadInicial(g) : actual + paso(g);
          return { items: { ...items, [g.nombre]: redondear(nueva) } };
        }),

      restar: (g) =>
        set(({ items }) => {
          const actual = items[g.nombre];
          if (actual === undefined) return {};
          const nueva = redondear(actual - paso(g));
          const resto = { ...items };
          if (nueva <= 0) delete resto[g.nombre];
          else resto[g.nombre] = nueva;
          return { items: resto };
        }),

      quitar: (nombres) =>
        set(({ items }) => ({
          items: Object.fromEntries(Object.entries(items).filter(([n]) => !nombres.includes(n))),
        })),

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
      version: 2,
      migrate: (guardado, version) => migrar(guardado, version) as EstadoCanasta,
    },
  ),
);
