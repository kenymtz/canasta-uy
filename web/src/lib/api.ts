// Tipos y llamadas a la API (api/main.py). Los tipos copian los modelos de Pydantic.

export type Unidad = "kg" | "l" | "unidad" | "m";

export interface Ciudad {
  departamento: string;
  ciudad: string;
  comercios: number;
  lat: number;
  lon: number;
}

export interface Generico {
  producto_canonico_id: number;
  nombre: string;
  categoria: string;
  unidad_base: Unidad;
  se_vende_suelto: boolean;
  comercios_con_precio: number;
}

export interface Comercio {
  establecimiento_id: number;
  nombre: string;
  cadena: string | null;
  direccion: string | null;
  ciudad: string | null;
  lat: number;
  lon: number;
  distancia_km: number;
}

export interface LineaCanasta {
  generico: string;
  producto: string;
  cantidad: number;
  unidades: number;
  precio: number;
  costo: number;
}

export interface ResultadoComercio {
  establecimiento_id: number;
  comercio: string;
  cadena: string | null;
  direccion: string | null;
  ciudad: string | null;
  distancia_km: number;
  productos_pedidos: number;
  productos_con_precio: number;
  cobertura: number;
  total: number;
  entra_en_presupuesto: boolean;
  faltantes: string[];
  fecha_precios: string;
  detalle: LineaCanasta[];
}

export interface PedidoCanasta {
  items: { producto_canonico_id: number; cantidad: number }[];
  lat: number;
  lon: number;
  radio_km: number;
  presupuesto: number | null;
  limite?: number;
}

export class ErrorApi extends Error {}

async function pedir<T>(ruta: string, opciones?: RequestInit): Promise<T> {
  const respuesta = await fetch(`/api${ruta}`, opciones);
  if (!respuesta.ok) {
    // FastAPI devuelve {"detail": "..."}; si no se puede leer, un mensaje genérico
    const cuerpo = await respuesta.json().catch(() => null);
    const detalle = typeof cuerpo?.detail === "string" ? cuerpo.detail : null;
    throw new ErrorApi(detalle ?? "No pudimos conectar con el servidor. Probá de nuevo.");
  }
  return respuesta.json() as Promise<T>;
}

export const api = {
  salud: () => pedir<{ estado: string; ultimo_precio: string }>("/salud"),
  ciudades: () => pedir<Ciudad[]>("/ciudades"),
  genericos: () => pedir<Generico[]>("/genericos"),
  comercios: (lat: number, lon: number, radioKm: number) =>
    pedir<Comercio[]>(`/comercios?lat=${lat}&lon=${lon}&radio_km=${radioKm}`),
  cotizar: (pedido: PedidoCanasta, signal?: AbortSignal) =>
    pedir<ResultadoComercio[]>("/canasta/cotizar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pedido),
      signal,
    }),
};
