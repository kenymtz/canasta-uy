import { ArrowDown, ArrowUp, CheckCircle, ShieldCheck } from "@phosphor-icons/react";
import { useState } from "react";

import { anterior, type Compra, diferencia } from "../lib/compras";
import { formatoPlata } from "../lib/formato";
import type { Ubicacion } from "../store/canasta";
import { useCompras } from "../store/compras";
import { type Borrador, ConfirmarCompra } from "./ConfirmarCompra";
import { Cuenta } from "./Cuenta";
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
      "La foto nunca sale de tu teléfono: el texto se lee ahí mismo, borramos todo lo que parezca un dato de pago o personal (tarjeta, cédula, nombre, cuenta) y te mostramos lo que se guarda antes de guardarlo.",
  },
];

const VACIO: Borrador = { qr: null, productos: null };

/** Después de guardar: cuánto gastó comparado con la compra anterior. */
function Guardada({ compra }: { compra: Compra }) {
  const compras = useCompras((s) => s.compras);
  const previa = anterior(compras, compra);
  const dif = previa ? diferencia(compra, previa) : null;
  return (
    <div className="aparecer flex flex-col gap-1.5 rounded-caja border border-acento/40 bg-acento-suave px-4 py-3" role="status">
      <p className="flex items-center gap-1.5 text-[14px] font-semibold text-acento">
        <CheckCircle size={18} weight="fill" aria-hidden />
        Guardada en Mis compras
      </p>
      {dif && previa ? (
        <p className="text-[13.5px] leading-snug">
          {dif.monto === 0 ? (
            "Gastaste lo mismo que en tu compra anterior."
          ) : (
            <>
              Gastaste{" "}
              <strong className={`numeros inline-flex items-center gap-0.5 ${dif.monto > 0 ? "text-alerta" : "text-acento"}`}>
                {dif.monto > 0 ? <ArrowUp size={13} weight="bold" aria-hidden /> : <ArrowDown size={13} weight="bold" aria-hidden />}
                {formatoPlata(Math.abs(dif.monto))} {dif.monto > 0 ? "más" : "menos"}
              </strong>{" "}
              que en tu compra anterior ({previa.fecha.split("-").reverse().join("/")}
              {previa.comercio && `, ${previa.comercio.nombre}`}).
            </>
          )}
        </p>
      ) : (
        <p className="text-[13.5px] leading-snug">Es tu primera compra guardada: con la próxima te mostramos la diferencia.</p>
      )}
    </div>
  );
}

export function SumarTicket({ ubicacion }: { ubicacion: Ubicacion | null }) {
  const [opcion, setOpcion] = useState<Opcion>("qr");
  const [borrador, setBorrador] = useState<Borrador>(VACIO);
  const [guardada, setGuardada] = useState<Compra | null>(null);
  // Cambiar la clave reinicia los lectores (quedan listos para el próximo ticket)
  const [vuelta, setVuelta] = useState(0);
  const hayCompras = useCompras((s) => s.compras.length > 0);
  const actual = OPCIONES.find((o) => o.id === opcion)!;
  const hayBorrador = borrador.qr !== null || borrador.productos !== null;

  function empezarDeNuevo() {
    setBorrador(VACIO);
    setVuelta((n) => n + 1);
  }

  return (
    <section aria-labelledby="titulo-ticket" className="flex flex-col gap-4 rounded-caja border border-linea bg-ticket p-4 sm:p-5">
      <div className="flex flex-col gap-1">
        <h2 id="titulo-ticket" className="text-lg font-semibold tracking-tight">
          Sumá tu compra
        </h2>
        <p className="text-[14px] leading-snug text-tinta-suave">
          Guardá qué compraste, cuánto y dónde, y compará con tu compra anterior.
        </p>
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

      {/* Los dos lectores quedan montados: al cambiar de pestaña no se pierde lo leído */}
      <div id="panel-ticket" role="tabpanel" aria-labelledby={`pestana-${opcion}`}>
        <div hidden={opcion !== "qr"}>
          <OpcionQr
            key={`qr-${vuelta}`}
            onLeido={(qr) => {
              setGuardada(null);
              setBorrador((b) => ({ ...b, qr }));
            }}
          />
        </div>
        <div hidden={opcion !== "boleta"}>
          <OpcionBoleta
            key={`boleta-${vuelta}`}
            onListo={(productos) => {
              setGuardada(null);
              setBorrador((b) => ({ ...b, productos }));
            }}
          />
        </div>
      </div>

      {hayBorrador && (
        <ConfirmarCompra
          // Un ticket nuevo (otro QR) arranca la confirmación de cero
          key={borrador.qr ? `${borrador.qr.ruc}-${borrador.qr.numero}` : "sin-qr"}
          borrador={borrador}
          ubicacion={ubicacion}
          onIrA={setOpcion}
          onGuardada={(compra) => {
            setGuardada(compra);
            empezarDeNuevo();
          }}
          onDescartar={empezarDeNuevo}
        />
      )}

      {guardada && <Guardada compra={guardada} />}

      {!hayCompras && <Cuenta />}
    </section>
  );
}
