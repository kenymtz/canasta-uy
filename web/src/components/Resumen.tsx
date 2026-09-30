import NumberFlow from "@number-flow/react";
import { ArrowDown } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import type { ResultadoComercio } from "../lib/api";

export const ID_TICKET = "ticket-destacado";

interface Props {
  mejor: ResultadoComercio | undefined;
}

/**
 * Barra fija abajo con el comercio que más conviene: con una canasta larga, el ticket
 * queda lejos. Se esconde cuando el ticket ya está a la vista.
 */
export function Resumen({ mejor }: Props) {
  const [ticketVisible, setTicketVisible] = useState(false);

  useEffect(() => {
    const ticket = document.getElementById(ID_TICKET);
    if (!ticket) return;
    const observador = new IntersectionObserver(([e]) => setTicketVisible(e.isIntersecting), { threshold: 0.15 });
    observador.observe(ticket);
    return () => observador.disconnect();
  }, [mejor?.establecimiento_id]);

  if (!mejor || ticketVisible) return null;

  const completo = mejor.cobertura === 1;
  function verTicket() {
    document.getElementById(ID_TICKET)?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  }

  return (
    <div className="imprimir sticky bottom-4 z-10 -mx-1 mt-auto">
      <button
        type="button"
        onClick={verTicket}
        className="presionable flex w-full items-center gap-3 rounded-caja bg-tinta px-4 py-3 text-left text-panel shadow-[0_12px_28px_rgb(20_32_27_/_0.25)]"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] opacity-75">{completo ? "Te conviene" : "El que tiene más de tu canasta"}</span>
          <span className="line-clamp-2 block text-[15px] leading-tight font-semibold">{mejor.comercio}</span>
        </span>
        <NumberFlow
          value={mejor.total}
          locales="es-UY"
          format={{ style: "currency", currency: "UYU", maximumFractionDigits: 2 }}
          className="numeros text-lg font-semibold"
        />
        <span className="inline-flex items-center gap-1 rounded-control bg-acento px-2.5 py-1.5 text-[13px] font-semibold text-sobre-acento">
          {/* En pantallas chicas queda solo la flecha, para dejarle lugar al nombre */}
          <span className="sr-only sm:not-sr-only">Ver ticket</span>
          <ArrowDown size={14} weight="bold" aria-hidden />
        </span>
      </button>
    </div>
  );
}
