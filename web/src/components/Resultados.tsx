import { ArrowClockwise, ArrowsOutSimple } from "@phosphor-icons/react";
import { type ReactNode, useEffect } from "react";

import type { Fase } from "../hooks/useCotizacion";
import type { Generico, ResultadoComercio } from "../lib/api";
import { TicketDestacado, TicketFila } from "./Ticket";

interface Props {
  fase: Fase;
  resultados: ResultadoComercio[];
  error: string | null;
  genericos: Map<string, Generico>;
  presupuesto: number | null;
  radioKm: number;
  hayUbicacion: boolean;
  hayProductos: boolean;
  seleccionado: number | null;
  onSeleccionar: (id: number | null) => void;
  onAmpliar: () => void;
  onReintentar: () => void;
}

const botonSecundario =
  "presionable inline-flex h-10 items-center gap-1.5 rounded-control border border-linea bg-ticket px-3 text-sm font-medium text-tinta hover:border-tinta-suave";

function Aviso({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-caja border border-dashed border-linea px-4 py-5 text-sm text-tinta-suave">
      {children}
    </div>
  );
}

/** Esqueleto con la forma del ticket mientras llega la primera cotización. */
function Esqueleto() {
  return (
    <div className="ticket-sombra" aria-hidden>
      <div className="ticket flex flex-col gap-3 px-5 pt-5 motion-safe:animate-pulse">
        <div className="h-3 w-28 rounded bg-linea" />
        <div className="h-5 w-48 rounded bg-linea" />
        <div className="ticket-corte my-2" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex justify-between">
            <div className="h-3.5 w-36 rounded bg-linea" />
            <div className="h-3.5 w-14 rounded bg-linea" />
          </div>
        ))}
        <div className="ticket-corte my-2" />
        <div className="ml-auto h-7 w-32 rounded bg-linea" />
      </div>
    </div>
  );
}

export function Resultados(p: Props) {
  const [mejor, ...resto] = p.resultados;

  // Si se elige un comercio en el mapa, se lo trae a la vista en la lista
  useEffect(() => {
    if (p.seleccionado === null) return;
    document
      .querySelector(`[data-establecimiento="${p.seleccionado}"]`)
      ?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "nearest",
      });
  }, [p.seleccionado]);

  let contenido: ReactNode;
  if (!p.hayUbicacion) {
    contenido = <Aviso>Elegí dónde estás para ver los comercios cercanos.</Aviso>;
  } else if (!p.hayProductos) {
    contenido = <Aviso>Agregá productos a tu canasta y te mostramos dónde te conviene comprarla.</Aviso>;
  } else if (p.fase === "error") {
    contenido = (
      <Aviso>
        <p>{p.error}</p>
        <button type="button" className={botonSecundario} onClick={p.onReintentar}>
          <ArrowClockwise size={18} aria-hidden />
          Reintentar
        </button>
      </Aviso>
    );
  } else if (p.fase === "cargando" && p.resultados.length === 0) {
    contenido = <Esqueleto />;
  } else if (p.fase === "listo" && p.resultados.length === 0) {
    contenido = (
      <Aviso>
        <p>Ningún comercio a menos de {p.radioKm} km tiene estos productos.</p>
        {p.radioKm < 20 && (
          <button type="button" className={botonSecundario} onClick={p.onAmpliar}>
            <ArrowsOutSimple size={18} aria-hidden />
            Buscar hasta {Math.min(p.radioKm + 5, 20)} km
          </button>
        )}
      </Aviso>
    );
  } else if (mejor) {
    contenido = (
      // Mientras se recalcula, lo anterior queda visible pero atenuado: no salta la pantalla
      <div className={`flex flex-col gap-6 transition-opacity duration-200 ${p.fase === "cargando" ? "opacity-60" : ""}`}>
        <TicketDestacado key={mejor.establecimiento_id} r={mejor} genericos={p.genericos} presupuesto={p.presupuesto} />
        {resto.length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="text-[15px] font-semibold">Otros comercios cerca</h3>
            <ul className="flex flex-col divide-y divide-linea rounded-caja border border-linea bg-ticket">
              {resto.map((r) => (
                <TicketFila
                  key={r.establecimiento_id}
                  r={r}
                  genericos={p.genericos}
                  presupuesto={p.presupuesto}
                  abierto={p.seleccionado === r.establecimiento_id}
                  onAbrir={() => p.onSeleccionar(p.seleccionado === r.establecimiento_id ? null : r.establecimiento_id)}
                />
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <section aria-labelledby="titulo-conviene" aria-busy={p.fase === "cargando"} className="flex flex-col gap-4">
      <h2 id="titulo-conviene" className="text-lg font-semibold tracking-tight">
        Dónde conviene
      </h2>
      {contenido}
    </section>
  );
}
