// Del texto de una boleta a una lista de productos con precio, sin datos personales.
//
// Regla: ante la duda, se descarta. Una línea con cualquier indicio de dato de pago o de
// identificación (tarjeta, cuenta, autorización, cédula, cliente, cajero, email, RUT...) se
// borra entera. Los números largos que quedan dentro de una línea de producto (códigos de
// barras, por ejemplo) se tapan. Solo sobreviven las líneas que terminan en un precio.

export interface ProductoBoleta {
  descripcion: string;
  precio: number;
}

export interface LecturaBoleta {
  productos: ProductoBoleta[];
  /** Líneas borradas por tener posibles datos personales o de pago */
  quitadas: number;
}

const SENSIBLE = new RegExp(
  [
    "tarjeta", "\\b(visa|master(card)?|oca|amex|cabal|anda|creditel|maestro|redpagos)\\b",
    "d[eé]bito", "cr[eé]dito", "cuenta", "autoriz", "aprob", "voucher", "\\b(lote|terminal|pos)\\b",
    "c[eé]dula", "\\bc\\.?\\s?i\\b", "documento", "\\bdoc\\b", "cliente", "\\bsocio\\s*(n|#|:)",
    "e-?mail", "correo", "tel[eé]fono", "\\btel\\b", "celular", "cajer", "vendedor", "atendi",
    "\\b(rut|ruc)\\b", "consumidor",
  ].join("|"),
  "i",
);
const EMAIL = /\S+@\S+/;
const TARJETA_TAPADA = /[*xX•]{2,}\s?\d{2,4}/;
// Totales, impuestos y demás líneas con monto que no son productos. Incluye el recuadro de
// impuestos de algunos comercios: "T.M.Imp.: 82,17", "IVA T.B.: 23,01"
const NO_ES_PRODUCTO = /(sub\s?total|total|\biva\b|\bimp\b|imponible|\bneto\b|gravad|exent|redondeo|descuento|\bdto\b|bonif|cambio|efectivo|vuelto|\bpago\b|saldo|e-?ticket|factura|serie|fecha|hora)/i;
// El monto al final de la línea. Algunos comercios le pegan la letra de la tasa de IVA
// ("45,28M", "127,60 B") o un asterisco: se aceptan y se ignoran.
const PRECIO_AL_FINAL = /(-?\d{1,3}(?:[.,]\d{3})+[.,]\d{2}|-?\d+[.,]\d{2})\s*[A-Za-z*]?\s*$/;
// Columnas de cantidad y precio unitario antes del monto ("1,000   45,28" o "0,794 160,70")
const COLUMNAS_ANTES_DEL_MONTO = /(\s+-?\d+(?:[.,]\d{1,3})?){1,2}\s*$/;
// Código de artículo al principio ("31410 SAL SEK FINA..."): no dice nada del producto
const CODIGO_AL_PRINCIPIO = /^\d{3,6}\s+/;
// Una descripción de producto tiene palabras; "TM." o "a 82,17" son ruido del lector
const MINIMO_DE_LETRAS = 3;
const NUMERO_LARGO = /\d(?:[\s.-]?\d){6,}/g; // 7 dígitos o más, con o sin separadores

/** "1.250,00" → 1250; "45.90" → 45.9 (las boletas siempre traen dos decimales). */
function aNumero(precio: string): number {
  return Number(precio.replace(/[^\d-]/g, "")) / 100;
}

export function leerBoleta(texto: string): LecturaBoleta {
  const productos: ProductoBoleta[] = [];
  let quitadas = 0;

  for (const cruda of texto.split(/\r?\n/)) {
    const linea = cruda.trim();
    if (!linea) continue;

    if (SENSIBLE.test(linea) || EMAIL.test(linea) || TARJETA_TAPADA.test(linea)) {
      quitadas++;
      continue;
    }

    const precio = PRECIO_AL_FINAL.exec(linea);
    if (!precio) continue; // encabezados, direcciones, números de comprobante: no se envían

    const descripcion = linea
      .slice(0, precio.index)
      .replace(COLUMNAS_ANTES_DEL_MONTO, "")
      .replace(CODIGO_AL_PRINCIPIO, "")
      .replace(NUMERO_LARGO, "•••")
      .replace(/[\s—–_|]+$/, "") // rayas y separadores que el lector agrega al final
      .replace(/\s{2,}/g, " ")
      .trim();
    const valor = aNumero(precio[1]);
    const letras = descripcion.match(/\p{L}/gu)?.length ?? 0;
    if (letras < MINIMO_DE_LETRAS || NO_ES_PRODUCTO.test(descripcion) || valor <= 0) continue;

    productos.push({ descripcion, precio: valor });
  }

  return { productos, quitadas };
}
