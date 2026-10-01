// Historial de compras del usuario ("Mis compras"): qué compró, cuánto y dónde.
//
// Cada compra sale del ticket: el QR dice cuándo, cuánto y qué empresa (RUC); la foto de la
// boleta, qué productos. Como el RUC no dice qué sucursal es, el usuario confirma el comercio.
// Por ahora se guarda solo en el navegador (ver store/compras.ts).

import type { ProductoBoleta } from "./boleta";
import { normalizar } from "./formato";
import type { CompraQr } from "./qrDgi";

export interface ComercioCompra {
  establecimiento_id: number;
  nombre: string;
  direccion: string | null;
  ciudad: string | null;
}

export interface Compra {
  /** Con QR: el número del comprobante (así el mismo ticket no se guarda dos veces) */
  id: string;
  fecha: string; // AAAA-MM-DD
  total: number;
  ruc: string | null;
  comercio: ComercioCompra | null;
  productos: ProductoBoleta[];
  guardada: string; // fecha y hora ISO
}

export interface CambioDePrecio {
  descripcion: string;
  antes: number;
  ahora: number;
  /** 0.08 = subió 8 % */
  cambio: number;
}

/** Identificador del ticket: empresa, tipo, serie y número no se repiten entre comprobantes. */
export function idCompra(qr: CompraQr | null): string {
  if (qr) return `cfe-${qr.ruc}-${qr.tipo}-${qr.serie}-${qr.numero}`;
  return `sin-qr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** De la más nueva a la más vieja (por fecha de compra y, si empatan, por cuándo se guardó). */
export function ordenar(compras: Compra[]): Compra[] {
  return [...compras].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.guardada.localeCompare(a.guardada));
}

// El lector de la boleta a veces mete espacios de más: se comparan sin ellos
const clave = (descripcion: string) => normalizar(descripcion).replace(/\s+/g, " ").trim();

/** Las compras hechas antes que esta, de la más nueva a la más vieja. */
function previas(compras: Compra[], compra: Compra): Compra[] {
  return ordenar(compras).filter(
    (c) => c.id !== compra.id && (c.fecha < compra.fecha || (c.fecha === compra.fecha && c.guardada < compra.guardada)),
  );
}

/** La compra inmediatamente anterior a esta, sea donde sea. */
export function anterior(compras: Compra[], compra: Compra): Compra | undefined {
  return previas(compras, compra)[0];
}

/** Cuánto más (positivo) o menos (negativo) se gastó que en la compra anterior. */
export function diferencia(compra: Compra, previa: Compra): { monto: number; cambio: number } {
  const monto = Math.round((compra.total - previa.total) * 100) / 100;
  return { monto, cambio: previa.total > 0 ? monto / previa.total : 0 };
}

/**
 * Para cada producto de la compra, el precio que pagó la última vez que compró lo mismo
 * (mismo texto en la boleta, sin importar mayúsculas ni tildes). Solo los que cambiaron.
 */
export function cambiosDePrecio(compras: Compra[], compra: Compra): CambioDePrecio[] {
  const productosPrevios = previas(compras, compra).flatMap((c) => c.productos);
  const cambios: CambioDePrecio[] = [];
  for (const producto of compra.productos) {
    const antes = productosPrevios.find((p) => clave(p.descripcion) === clave(producto.descripcion));
    if (antes && antes.precio > 0 && antes.precio !== producto.precio) {
      cambios.push({
        descripcion: producto.descripcion,
        antes: antes.precio,
        ahora: producto.precio,
        cambio: (producto.precio - antes.precio) / antes.precio,
      });
    }
  }
  return cambios;
}

/** Si ya compró en esa empresa, el comercio que eligió la última vez (para no preguntar de nuevo). */
export function comercioSugerido(compras: Compra[], ruc: string | null): ComercioCompra | null {
  if (!ruc) return null;
  return ordenar(compras).find((c) => c.ruc === ruc && c.comercio)?.comercio ?? null;
}

/**
 * Junta las compras del teléfono con las de la cuenta, sin repetir tickets. Si un ticket
 * está en los dos lados, vale el de la cuenta.
 */
export function combinar(locales: Compra[], deLaCuenta: Compra[]): Compra[] {
  const enCuenta = new Set(deLaCuenta.map((c) => c.id));
  return [...deLaCuenta, ...locales.filter((c) => !enCuenta.has(c.id))];
}

/** Las compras del teléfono que todavía no están en la cuenta (hay que subirlas). */
export function faltanEnLaCuenta(locales: Compra[], deLaCuenta: Compra[]): Compra[] {
  const enCuenta = new Set(deLaCuenta.map((c) => c.id));
  return locales.filter((c) => !enCuenta.has(c.id));
}
