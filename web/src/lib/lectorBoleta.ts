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

/** Ancho al que se amplía el recorte: los tickets tienen letra chica y ampliar ayuda. */
export const ANCHO_DE_LECTURA = 2400;

/** Recorta, amplía y pasa a gris con más contraste (papel térmico: gris claro sobre blanco). */
export function prepararImagen(imagen: CanvasImageSource, recorte: Recorte): HTMLCanvasElement {
  const aumento = Math.max(1, ANCHO_DE_LECTURA / recorte.ancho);
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(recorte.ancho * aumento);
  lienzo.height = Math.round(recorte.alto * aumento);
  const ctx = lienzo.getContext("2d")!;
  ctx.filter = "grayscale(1) contrast(1.4)";
  ctx.drawImage(imagen, recorte.x, recorte.y, recorte.ancho, recorte.alto, 0, 0, lienzo.width, lienzo.height);
  return lienzo;
}

export async function leerTexto(
  imagen: CanvasImageSource,
  recorte: Recorte,
  alProgreso: (p: number) => void = () => {},
): Promise<string> {
  const lienzo = prepararImagen(imagen, recorte);
  const { createWorker, PSM } = await import("tesseract.js"); // pesa: se carga solo si se usa
  const trabajador = await createWorker("spa", 1, {
    logger: (m) => m.status === "recognizing text" && alProgreso(m.progress),
  });
  // Un ticket es un solo bloque de renglones: leerlo así (en lugar de buscar columnas y
  // párrafos sueltos) mantiene cada producto en la misma línea que su precio
  await trabajador.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: "1" });
  try {
    const { data } = await trabajador.recognize(lienzo);
    return data.text;
  } finally {
    await trabajador.terminate();
  }
}
