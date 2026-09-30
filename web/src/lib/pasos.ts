import type { Generico } from "./api";

// Cuánto suma cada toque en "+". Hay excepciones con nombre propio porque se compran en
// tamaños fijos conocidos: los huevos por media docena, el papel en paquetes de 4 × 30 m.
const PASOS_ESPECIALES: Record<string, number> = {
  Huevos: 6,
  "Papel higiénico": 120,
};

const INICIALES_ESPECIALES: Record<string, number> = {
  "Aceite de girasol": 0.9,
  "Aceite de maíz": 0.9,
  "Aceite de soja": 0.9,
};

export function paso(g: Generico): number {
  if (g.nombre in PASOS_ESPECIALES) return PASOS_ESPECIALES[g.nombre];
  if (g.unidad_base === "kg" || g.unidad_base === "l") return 0.5;
  return 1;
}

export function cantidadInicial(g: Generico): number {
  return INICIALES_ESPECIALES[g.nombre] ?? paso(g);
}
