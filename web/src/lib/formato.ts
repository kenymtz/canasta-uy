import type { Unidad } from "./api";

const numero = (decimales: number) =>
  new Intl.NumberFormat("es-UY", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });

const entero = numero(0);
const conCentesimos = numero(2);
const hastaDosDecimales = new Intl.NumberFormat("es-UY", { maximumFractionDigits: 2 });

/**
 * $ 1.480,50 o $ 79 si es un monto entero. Entre el signo y el número va un espacio que no
 * se corta ( ): así el "$" nunca queda solo al final de un renglón.
 */
export function formatoPlata(monto: number): string {
  const redondeado = Math.round(monto * 100) / 100;
  const formato = Number.isInteger(redondeado) ? entero : conCentesimos;
  return `$ ${formato.format(redondeado)}`;
}

/** Número y unidad por separado (para animar el número): 0,5 kg → 500 g. */
export function partesCantidad(cantidad: number, unidad: Unidad): { valor: number; sufijo: string } {
  if (unidad === "kg" && cantidad < 1) return { valor: Math.round(cantidad * 1000), sufijo: "g" };
  if (unidad === "l" && cantidad < 1) return { valor: Math.round(cantidad * 1000), sufijo: "ml" };
  return { valor: cantidad, sufijo: { kg: "kg", l: "l", unidad: "u", m: "m" }[unidad] };
}

/** 500 g, 1,5 kg, 900 ml, 2 l, 12 u, 120 m. */
export function formatoCantidad(cantidad: number, unidad: Unidad): string {
  const { valor, sufijo } = partesCantidad(cantidad, unidad);
  return `${(Number.isInteger(valor) ? entero : hastaDosDecimales).format(valor)} ${sufijo}`;
}

/** Quita tildes y mayúsculas para buscar: "azucar" encuentra "Azúcar". */
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** "Papa Blanca,  1.0 kilogramos" → "Papa Blanca": el SIPC repite la cantidad al final. */
export function nombreProducto(nombre: string): string {
  return nombre.replace(/,\s+\d+(\.\d+)?\s+\p{L}+\s*$/u, "");
}
