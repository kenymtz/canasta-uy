// En GitHub Pages la web no vive en la raíz del dominio sino en /canasta-uy/, así que los
// archivos de public/ se piden a partir de BASE_URL (Vite lo completa según "base").

/** Dirección completa de un archivo de public/, por ejemplo rutaPublica("geo/uruguay.geojson"). */
export function rutaPublica(ruta: string): string {
  // Completa: el mapa descarga los archivos desde otro hilo, que no sabe dónde está la página
  return new URL(`${import.meta.env.BASE_URL}${ruta}`, window.location.origin).href;
}
