import { ShieldCheck } from "@phosphor-icons/react";
import { useState } from "react";

import { OpcionBoleta } from "./OpcionBoleta";
import { OpcionQr } from "./OpcionQr";

type Opcion = "qr" | "boleta";

const OPCIONES: Array<{ id: Opcion; titulo: string; privacidad: string }> = [
  {
    id: "qr",
    titulo: "Solo el QR",
    privacidad:
      "El QR no tiene tu nombre, tu cédula ni tu tarjeta: solo el comercio, la fecha y el total. La foto se lee en tu teléfono y no se sube a ningún lado.",
  },
  {
    id: "boleta",
    titulo: "Leer la boleta",
    privacidad:
      "La foto nunca sale de tu teléfono: el texto se lee ahí mismo, borramos todo lo que parezca un dato de pago o personal (tarjeta, cédula, nombre, cuenta) y te mostramos lo que se enviaría antes de mandar nada.",
  },
];

export function SumarTicket() {
  const [opcion, setOpcion] = useState<Opcion>("qr");
  const actual = OPCIONES.find((o) => o.id === opcion)!;

  return (
    <section aria-labelledby="titulo-ticket" className="flex flex-col gap-4 rounded-caja border border-linea bg-ticket p-4 sm:p-5">
      <div className="flex flex-col gap-1">
        <h2 id="titulo-ticket" className="text-lg font-semibold tracking-tight">
          Sumá tu compra
        </h2>
        <p className="text-[14px] leading-snug text-tinta-suave">Con tu ticket ayudás a que los precios estén al día.</p>
      </div>

      <div role="tablist" aria-label="Qué querés sumar" className="grid grid-cols-2 gap-1 rounded-control bg-panel p-1">
        {OPCIONES.map((o) => (
          <button
            key={o.id}
            type="button"
            role="tab"
            id={`pestana-${o.id}`}
            aria-selected={o.id === opcion}
            aria-controls="panel-ticket"
            onClick={() => setOpcion(o.id)}
            className={`presionable h-9 rounded-[8px] text-sm font-medium ${
              o.id === opcion ? "bg-ticket text-tinta shadow-[0_1px_3px_rgb(20_32_27_/_0.12)]" : "text-tinta-suave"
            }`}
          >
            {o.titulo}
          </button>
        ))}
      </div>

      <p className="flex gap-2 rounded-control bg-acento-suave px-3 py-2.5 text-[13px] leading-snug text-tinta">
        <ShieldCheck size={18} weight="fill" className="mt-px shrink-0 text-acento" aria-hidden />
        <span>{actual.privacidad}</span>
      </p>

      <div id="panel-ticket" role="tabpanel" aria-labelledby={`pestana-${opcion}`}>
        {opcion === "qr" ? <OpcionQr /> : <OpcionBoleta />}
      </div>
    </section>
  );
}
