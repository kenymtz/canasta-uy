// Lectura del texto de una foto de boleta, en el navegador (tesseract.js). La foto nunca sale
// del teléfono: solo se descarga, una vez, el modelo del idioma español.
//
// Está aparte del componente para que el banco de pruebas (eval/boletas) use exactamente el
// mismo código que la web.

/** Parte de la foto a leer, en píxeles de la imagen original. */
export interface Recorte {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

/** Cómo se prepara la imagen antes de leerla. El banco de pruebas prueba otras opciones. */
export interface Preparacion {
  /** Ancho al que se amplía el recorte: los tickets tienen letra chica y ampliar ayuda */
  ancho: number;
  /**
   * Niveles automáticos: el gris más oscuro (este porcentaje de los píxeles) pasa a negro y el
   * papel a blanco. El papel térmico se imprime en gris claro y se va borrando: estirar los
   * grises hace que la tinta gastada vuelva a leerse. 0 = sin niveles.
   */
  niveles: number;
  /**
   * Aplanar el fondo: se divide la imagen por una copia muy borrosa de sí misma (de este radio,
   * en píxeles de la imagen ampliada). Las manchas, sombras y arrugas del papel son grandes y
   * desaparecen; las letras son chicas y quedan. 0 = sin aplanar.
   */
  fondo: number;
}

// Elegidos con el banco de pruebas (eval/boletas): ver su README
export const PREPARACION: Preparacion = { ancho: 1800, niveles: 0.02, fondo: 0 };

/** Recorta, amplía, pasa a gris y estira los grises. */
export function prepararImagen(imagen: CanvasImageSource, recorte: Recorte, p: Preparacion = PREPARACION): HTMLCanvasElement {
  const aumento = Math.max(1, p.ancho / recorte.ancho);
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(recorte.ancho * aumento);
  lienzo.height = Math.round(recorte.alto * aumento);
  const ctx = lienzo.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.filter = "grayscale(1) contrast(1.4)";
  ctx.drawImage(imagen, recorte.x, recorte.y, recorte.ancho, recorte.alto, 0, 0, lienzo.width, lienzo.height);
  if (p.fondo > 0) aplanarFondo(ctx, lienzo, p.fondo);
  if (p.niveles > 0) estirarGrises(ctx, lienzo.width, lienzo.height, p.niveles);
  return lienzo;
}

function aplanarFondo(ctx: CanvasRenderingContext2D, lienzo: HTMLCanvasElement, radio: number) {
  const { width: ancho, height: alto } = lienzo;
  const borroso = document.createElement("canvas");
  borroso.width = ancho;
  borroso.height = alto;
  const b = borroso.getContext("2d", { willReadFrequently: true })!;
  b.filter = `blur(${radio}px)`;
  b.drawImage(lienzo, 0, 0);
  const fondo = b.getImageData(0, 0, ancho, alto).data;
  const datos = ctx.getImageData(0, 0, ancho, alto);
  const p = datos.data;
  for (let i = 0; i < p.length; i += 4) {
    const v = Math.min(255, (p[i] / Math.max(1, fondo[i])) * 255);
    p[i] = p[i + 1] = p[i + 2] = v;
  }
  ctx.putImageData(datos, 0, 0);
}

function estirarGrises(ctx: CanvasRenderingContext2D, ancho: number, alto: number, niveles: number) {
  const datos = ctx.getImageData(0, 0, ancho, alto);
  const p = datos.data;
  // Histograma del gris (la imagen ya está en gris: alcanza con el canal rojo)
  const cuantos = new Uint32Array(256);
  for (let i = 0; i < p.length; i += 4) cuantos[p[i]]++;
  const total = ancho * alto;
  const percentil = (fraccion: number) => {
    let acumulado = 0;
    for (let v = 0; v < 256; v++) if ((acumulado += cuantos[v]) >= total * fraccion) return v;
    return 255;
  };
  const negro = percentil(niveles);
  const blanco = Math.max(negro + 1, percentil(0.9)); // la mayor parte de un ticket es papel
  for (let i = 0; i < p.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((p[i] - negro) / (blanco - negro)) * 255));
    p[i] = p[i + 1] = p[i + 2] = v;
  }
  ctx.putImageData(datos, 0, 0);
}

/**
 * Las formas de preparar la imagen que se prueban, en orden. Ninguna sirve para todas las
 * boletas (medido con el banco de pruebas): aplanar el fondo rescata las boletas manchadas y
 * arrugadas, pero empeora las de tinta muy gastada. Se leen las dos y se queda la mejor.
 */
export const PASADAS: Preparacion[] = [PREPARACION, { ...PREPARACION, fondo: 20 }];

/**
 * Lee el recorte con cada preparación y devuelve el texto que mejor puntúa (por ejemplo, el
 * que tiene más productos). Con una sola preparación es una lectura común.
 */
export async function leerTexto(
  imagen: CanvasImageSource,
  recorte: Recorte,
  alProgreso: (p: number) => void = () => {},
  pasadas: Preparacion[] = PASADAS,
  puntuar: (texto: string) => number = () => 0,
): Promise<string> {
  const { createWorker, PSM } = await import("tesseract.js"); // pesa: se carga solo si se usa
  let vuelta = 0;
  const trabajador = await createWorker("spa", 1, {
    logger: (m) => m.status === "recognizing text" && alProgreso((vuelta + m.progress) / pasadas.length),
  });
  // Un ticket es un solo bloque de renglones: leerlo así (en lugar de buscar columnas y
  // párrafos sueltos) mantiene cada producto en la misma línea que su precio
  await trabajador.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: "1" });
  try {
    let mejor = { texto: "", puntaje: -Infinity };
    for (const preparacion of pasadas) {
      const { data } = await trabajador.recognize(prepararImagen(imagen, recorte, preparacion));
      const puntaje = puntuar(data.text);
      if (puntaje > mejor.puntaje) mejor = { texto: data.text, puntaje };
      vuelta++;
    }
    return mejor.texto;
  } finally {
    await trabajador.terminate();
  }
}
