// Lectura del código QR de los comprobantes fiscales electrónicos (CFE) de la DGI.
//
// El QR es un enlace con los datos separados por comas, en este orden:
//   https://www.efactura.dgi.gub.uy/consultaQR/cfe?RUC,tipo,serie,número,monto,fecha,código
// La fecha va en dd/mm/aaaa. No incluye datos de quien compra: solo identifica al comercio
// (su RUC) y la compra (tipo, serie, número, total y fecha).

export interface CompraQr {
  ruc: string;
  tipo: string;
  serie: string;
  numero: string;
  monto: number;
  fecha: string; // AAAA-MM-DD
}

const TIPOS: Record<string, string> = {
  "101": "e-Ticket",
  "111": "e-Factura",
};

export function leerQrDgi(texto: string): CompraQr | null {
  let url: URL;
  try {
    url = new URL(texto.trim());
  } catch {
    return null;
  }
  const esDgi = /^(www\.)?efactura\.dgi\.gub\.uy$/i.test(url.hostname) && /\/consultaQR\/cfe$/i.test(url.pathname);
  if (!esDgi) return null;

  const campos = decodeURIComponent(url.search.slice(1)).split(",");
  if (campos.length < 7) return null;
  const [ruc, tipo, serie, numero, monto, fecha] = campos;

  const fechaOk = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(fecha);
  const montoOk = Number(monto);
  if (!/^\d{12}$/.test(ruc) || !fechaOk || !Number.isFinite(montoOk)) return null;

  return {
    ruc,
    tipo: TIPOS[tipo] ?? `CFE ${tipo}`,
    serie,
    numero,
    monto: montoOk,
    fecha: `${fechaOk[3]}-${fechaOk[2]}-${fechaOk[1]}`,
  };
}
