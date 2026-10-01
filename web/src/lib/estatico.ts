// La "API" de la web estática: en lugar de preguntarle al servidor, lee los archivos de
// public/datos (los genera pipelines/exportar/web_estatica.py) y cotiza en el navegador.
// Devuelve lo mismo que la API, así el resto de la web no nota la diferencia.

import type { Ciudad, Comercio, Generico, PedidoCanasta, ResultadoComercio } from "./api";
import { ErrorApi } from "./api";
import {
  type ComercioBase,
  comerciosCercanos,
  cotizarCanasta,
  type DatosPrecios,
  type IndicePrecios,
  indexarPrecios,
} from "./cotizar";
import { rutaPublica } from "./rutas";

interface DatosBase {
  ultimo_precio: string;
  ciudades: Ciudad[];
  genericos: Generico[];
  comercios: ComercioBase[];
}

async function descargar<T>(archivo: string): Promise<T> {
  const respuesta = await fetch(rutaPublica(`datos/${archivo}`)).catch(() => null);
  if (!respuesta?.ok) throw new ErrorApi("No pudimos cargar los precios. Probá de nuevo.");
  return respuesta.json() as Promise<T>;
}

// Cada archivo se descarga una sola vez y queda guardado; si falla, se reintenta la próxima
let base: Promise<DatosBase> | null = null;
let precios: Promise<IndicePrecios> | null = null;

function cargarBase(): Promise<DatosBase> {
  base ??= descargar<DatosBase>("base.json").catch((e) => {
    base = null;
    throw e;
  });
  return base;
}

function cargarPrecios(): Promise<IndicePrecios> {
  precios ??= descargar<DatosPrecios>("precios.json")
    .then(indexarPrecios)
    .catch((e) => {
      precios = null;
      throw e;
    });
  return precios;
}

export const apiEstatica = {
  salud: async () => ({ estado: "ok", ultimo_precio: (await cargarBase()).ultimo_precio }),
  ciudades: async () => (await cargarBase()).ciudades,
  genericos: async () => (await cargarBase()).genericos,
  comercios: async (lat: number, lon: number, radioKm: number): Promise<Comercio[]> =>
    comerciosCercanos((await cargarBase()).comercios, lat, lon, radioKm),
  cotizar: async (pedido: PedidoCanasta, signal?: AbortSignal): Promise<ResultadoComercio[]> => {
    const [{ comercios, genericos }, indice] = await Promise.all([cargarBase(), cargarPrecios()]);
    signal?.throwIfAborted();
    try {
      return cotizarCanasta(pedido, { comercios, genericos, indice });
    } catch (e) {
      throw new ErrorApi((e as Error).message);
    }
  },
};
