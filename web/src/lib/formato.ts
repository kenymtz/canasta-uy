import type { Unidad } from "./api";

const numero = (decimales: number) =>
  new Intl.NumberFormat("es-UY", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });

const entero = numero(0);
const conCentesimos = numero(2);
const hastaDosDecimales = new Intl.NumberFormat("es-UY", { maximumFractionDigits: 2 });

/** $ 1.480,50 o $ 79 si es un monto entero. */
export function formatoPlata(monto: number): string {
  const redondeado = Math.round(monto * 100) / 100;
  const formato = Number.isInteger(redondeado) ? entero : conCentesimos;
  return `$ ${formato.format(redondeado)}`;
}

/** 500 g, 1,5 kg, 900 ml, 2 l, 12 u, 120 m. */
export function formatoCantidad(cantidad: number, unidad: Unidad): string {
  if (unidad === "kg" && cantidad < 1) return `${entero.format(cantidad * 1000)} g`;
  if (unidad === "l" && cantidad < 1) return `${entero.format(cantidad * 1000)} ml`;
  const sufijo = { kg: "kg", l: "l", unidad: "u", m: "m" }[unidad];
  return `${hastaDosDecimales.format(cantidad)} ${sufijo}`;
}

/** Quita tildes y mayúsculas para buscar: "azucar" encuentra "Azúcar". */
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** "Papa Blanca,  1.0 kilogramos" → "Papa Blanca": el SIPC repite la cantidad al final. */
export function nombreProducto(nombre: string): string {
  return nombre.replace(/,\s+\d+(\.\d+)?\s+\p{L}+\s*$/u, "");
}
