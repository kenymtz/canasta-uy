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
// impuestos de algunos comercios: "T.M.Imp.: 82,17", "T.BImp.: 44,63", "T.Expa.: 0,00", "IVA T.B.: 23,01"
const NO_ES_PRODUCTO = /(sub\s?total|total|\biva\b|\bimp\b|imponible|\bneto\b|gravad|exent|\bt\.\s?[ebm]\.|\bt\.\s?(?:[ebm]\.?\s?imp|exp)|redondeo|descuento|\bdto\b|bonif|cambio|efectivo|vuelto|\bpago\b|saldo|e-?ticket|factura|serie|fecha|hora)/i;
// Títulos de las columnas: no son productos aunque tengan letras
const CABECERA = /(descripci|producto|importe|cantidad|\bcant\b|precio|monto)/i;
// El monto al final de la línea. Algunos comercios le pegan la letra de la tasa de IVA
// ("45,28M", "127,60 B") y el lector a veces agrega un signo o un espacio después de la coma
// ("407, 32B", "250,42?"): se aceptan y se ignoran.
const PRECIO_AL_FINAL = /(-?\d{1,3}(?:[.,]\d{3})+[.,]\s?\d{2}|-?\d+[.,]\s?\d{2})\s*[A-Za-z*?]?\s*$/;
// Columnas de cantidad y precio unitario antes del monto ("1,000   45,28" o "0,794 160,70")
const COLUMNAS_ANTES_DEL_MONTO = /(\s+-?\d+(?:[.,]\d{1,3})?){1,2}\s*$/;
// Productos en dos renglones: el nombre arriba y "2 x 176,55      353,10" abajo
const CANTIDAD_POR_UNITARIO = /^\d+(?:[.,]\d+)?\s*[xX×*]/;
// Código de artículo al principio ("31410 SAL SEK FINA..."): no dice nada del producto. El
// lector a veces cambia la primera cifra por una letra o un signo ("H575", "%575")
const CODIGO_AL_PRINCIPIO = /^[^\s\d]?\d{3,6}\s+/;
// Una descripción de producto tiene palabras; "TM." o "a 82,17" son ruido del lector
const MINIMO_DE_LETRAS = 3;
const NUMERO_LARGO = /\d(?:[\s.-]?\d){6,}/g; // 7 dígitos o más, con o sin separadores

/** "1.250,00" → 1250; "45.90" → 45.9 (las boletas siempre traen dos decimales). */
function aNumero(precio: string): number {
  return Number(precio.replace(/[^\d-]/g, "")) / 100;
}

function limpiar(descripcion: string): string {
  return descripcion
    .replace(COLUMNAS_ANTES_DEL_MONTO, "")
    .replace(CODIGO_AL_PRINCIPIO, "")
    .replace(NUMERO_LARGO, "•••")
    .replace(/[\s—–_|]+$/, "") // rayas y separadores que el lector agrega al final
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ─── Columnas de cantidad y precio ───────────────────────────────────────────
// En las boletas con columnas la cantidad trae 3 decimales ("1,000", "0,794") y los precios 2.
// En una foto chica (WhatsApp, captura) la coma suele desaparecer: "1000  4528" es
// 1,000 × 45,28. Con esa estructura se recupera el precio, y cantidad × unitario = monto
// sirve de control.
const NUMEROS_AL_FINAL = /(?:\s+\d+(?:[.,]\d+)?){2,3}\s*[A-Za-z*?]?\s*$/;
const NUMEROS_ANTES_DEL_PRECIO = /(?:\s+\d+(?:[.,]\d+)?){1,2}\s*$/;
const PRECIO_MAXIMO = 20000; // más que esto en un renglón es un número de otra cosa

/** "1,000" o "0,794"; sin coma, "1000" o "0794" (los kilos enteros o menos de un kilo). */
function aCantidad(t: string): number | null {
  if (/^\d+[.,]\d{3}$/.test(t)) return Number(t.replace(",", "."));
  if (/^\d{4}$/.test(t) && (t.startsWith("0") || t.endsWith("000"))) return Number(t) / 1000;
  return null;
}

/** "45,28"; sin coma, "4528" (siempre dos decimales). */
function aPrecio(t: string): number | null {
  if (/^\d+[.,]\d{2}$/.test(t) || /^\d{3,6}$/.test(t)) return aNumero(t);
  return null;
}

const redondear = (n: number) => Math.round(n * 100) / 100;
const cierra = (cantidad: number, unitario: number, monto: number) =>
  Math.abs(cantidad * unitario - monto) <= Math.max(0.05, monto * 0.01);

/** Del final del renglón: "1000  4528" o "1000  4528  4528M" → el monto, si cierra. */
function montoSinComa(numeros: string): number | null {
  const [c, u, m] = numeros.trim().replace(/[A-Za-z*?]$/, "").trim().split(/\s+/);
  const cantidad = aCantidad(c);
  const unitario = aPrecio(u);
  if (cantidad === null || unitario === null) return null;
  if (m === undefined) return redondear(cantidad * unitario);
  const monto = aPrecio(m);
  return monto !== null && cierra(cantidad, unitario, monto) ? monto : null;
}

const letras = (texto: string) => texto.match(/\p{L}/gu)?.length ?? 0;
const pareceProducto = (descripcion: string) =>
  letras(descripcion) >= MINIMO_DE_LETRAS && !NO_ES_PRODUCTO.test(descripcion) && !CABECERA.test(descripcion);

export function leerBoleta(texto: string): LecturaBoleta {
  const productos: ProductoBoleta[] = [];
  let quitadas = 0;
  // El último renglón sin precio que podría ser el nombre de un producto en dos renglones
  let pendiente: string | null = null;

  for (const cruda of texto.split(/\r?\n/)) {
    const linea = cruda.trim();
    if (!linea) continue;

    if (SENSIBLE.test(linea) || EMAIL.test(linea) || TARJETA_TAPADA.test(linea)) {
      quitadas++;
      pendiente = null;
      continue;
    }

    const precio = PRECIO_AL_FINAL.exec(linea);
    const sinComa = precio ? null : NUMEROS_AL_FINAL.exec(linea);
    const montoRecuperado = sinComa ? montoSinComa(sinComa[0]) : null;
    if (sinComa && montoRecuperado !== null) {
      const descripcion = limpiar(linea.slice(0, sinComa.index));
      pendiente = null;
      if (pareceProducto(descripcion) && montoRecuperado > 0 && montoRecuperado <= PRECIO_MAXIMO) {
        productos.push({ descripcion, precio: montoRecuperado });
      }
      continue;
    }
    if (!precio) {
      // Encabezados, direcciones, números de comprobante: no se guardan, pero puede ser el
      // nombre de un producto cuyo precio viene en el renglón de abajo
      const posible = limpiar(linea);
      pendiente = pareceProducto(posible) ? posible : null;
      continue;
    }

    const antesDelPrecio = linea.slice(0, precio.index).trim();
    let descripcion = limpiar(antesDelPrecio);
    // Solo cantidad y "x" (el lector a veces lee "x" como "XxX"): el nombre es el de arriba
    if (CANTIDAD_POR_UNITARIO.test(antesDelPrecio) && /^[\d\s.,xX×*]*$/.test(descripcion) && pendiente) {
      descripcion = pendiente;
    }
    pendiente = null;

    let valor = aNumero(precio[1]);
    // "0,794   160,70" sin el monto: el precio leído es el unitario y el monto es la cuenta
    const antes = NUMEROS_ANTES_DEL_PRECIO.exec(antesDelPrecio)?.[0].trim().split(/\s+/);
    if (antes?.length === 1) {
      const cantidad = aCantidad(antes[0]);
      if (cantidad !== null) valor = redondear(cantidad * valor);
    }
    if (!pareceProducto(descripcion) || valor <= 0 || valor > PRECIO_MAXIMO) continue;
    productos.push({ descripcion, precio: valor });
  }

  return { productos, quitadas };
}
