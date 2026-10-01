import { useEffect, useState } from "react";

import { api, type Generico, type ResultadoComercio } from "../lib/api";
import type { Items, Ubicacion } from "../store/canasta";

export type Fase = "inactivo" | "cargando" | "listo" | "error";

interface Entrada {
  ubicacion: Ubicacion | null;
  radioKm: number;
  items: Items;
  presupuesto: number | null;
  /** Para pasar de nombre a id: la API y cotizar.ts piden ids */
  genericos: Map<string, Generico>;
}

interface Cotizacion {
  fase: Fase;
  resultados: ResultadoComercio[];
  error: string | null;
  reintentar: () => void;
}

const DEMORA_MS = 400; // espera a que el usuario deje de tocar + y − antes de pedir

/** Cotiza la canasta cada vez que cambia algo, sin pedir de más ni mostrar respuestas viejas. */
export function useCotizacion({ ubicacion, radioKm, items, presupuesto, genericos }: Entrada): Cotizacion {
  const [fase, setFase] = useState<Fase>("inactivo");
  const [resultados, setResultados] = useState<ResultadoComercio[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    // Los productos que ya no tienen precios quedan afuera (la canasta avisa cuáles son)
    const lista = Object.entries(items).flatMap(([nombre, cantidad]) => {
      const g = genericos.get(nombre);
      return g ? [{ producto_canonico_id: g.producto_canonico_id, cantidad }] : [];
    });
    if (!ubicacion || lista.length === 0) {
      setFase("inactivo");
      setResultados([]);
      return;
    }
    // Si llega un cambio nuevo, el pedido anterior se cancela: nunca pisa al más reciente
    const control = new AbortController();
    setFase("cargando");
    setError(null);
    const temporizador = setTimeout(() => {
      api
        .cotizar(
          {
            items: lista,
            lat: ubicacion.lat,
            lon: ubicacion.lon,
            radio_km: radioKm,
            presupuesto,
            limite: 30,
          },
          control.signal,
        )
        .then((r) => {
          setResultados(r);
          setFase("listo");
        })
        .catch((e: Error) => {
          if (control.signal.aborted) return;
          setError(e.message);
          setFase("error");
        });
    }, DEMORA_MS);
    return () => {
      clearTimeout(temporizador);
      control.abort();
    };
  }, [ubicacion, radioKm, items, presupuesto, genericos, intento]);

  return { fase, resultados, error, reintentar: () => setIntento((n) => n + 1) };
}
