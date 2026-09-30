import NumberFlow from "@number-flow/react";
import { CaretDown, CheckCircle, WarningCircle } from "@phosphor-icons/react";

import type { Generico, LineaCanasta, ResultadoComercio } from "../lib/api";
import { formatoCantidad, formatoPlata, nombreProducto } from "../lib/formato";

const km = new Intl.NumberFormat("es-UY", { maximumFractionDigits: 1 });
const FORMATO_TOTAL = { style: "currency", currency: "UYU", maximumFractionDigits: 2 } as const;

function fecha(iso: string) {
  const [anio, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${anio}`;
}

/** "2 × Aceite ... a $ 80" o "1,5 kg de Manzana ... a $ 139 el kg" si se vende suelto. */
function queComprar(linea: LineaCanasta, g: Generico | undefined): string {
  const producto = nombreProducto(linea.producto);
  if (g?.se_vende_suelto) {
    return `${formatoCantidad(linea.cantidad, g.unidad_base)} de ${producto} a ${formatoPlata(linea.precio)} el kg`;
  }
  return `${linea.unidades} × ${producto} a ${formatoPlata(linea.precio)}`;
}

function Lineas({ r, genericos }: { r: ResultadoComercio; genericos: Map<string, Generico> }) {
  return (
    <>
      <ul className="flex flex-col gap-2.5">
        {r.detalle.map((l) => (
          <li key={l.generico} className="grid grid-cols-[1fr_auto] gap-x-4">
            <span className="text-[14px] font-medium">{l.generico}</span>
            <span className="numeros text-right text-[14px]">{formatoPlata(l.costo)}</span>
            <span className="col-span-2 text-[12.5px] leading-snug text-tinta-suave">{queComprar(l, genericos.get(l.generico))}</span>
          </li>
        ))}
      </ul>
      {r.faltantes.length > 0 && (
        <p className="mt-3 flex gap-1.5 text-[13px] leading-snug text-alerta">
          <WarningCircle size={16} className="mt-px shrink-0" aria-hidden />
          <span>No tiene: {r.faltantes.join(", ")}</span>
        </p>
      )}
    </>
  );
}

function Presupuesto({ r, presupuesto }: { r: ResultadoComercio; presupuesto: number | null }) {
  if (presupuesto === null) return null;
  return r.entra_en_presupuesto ? (
    <p className="inline-flex items-center gap-1.5 rounded-full bg-acento-suave px-3 py-1 text-[13px] font-medium text-acento">
      <CheckCircle size={16} weight="fill" aria-hidden />
      Entra en tu presupuesto
    </p>
  ) : (
    <p className="text-[13px] font-medium text-alerta">Te pasás por {formatoPlata(r.total - presupuesto)}</p>
  );
}

interface PropsTicket {
  r: ResultadoComercio;
  genericos: Map<string, Generico>;
  presupuesto: number | null;
}

/** El ticket grande del comercio que más conviene. */
export function TicketDestacado({ r, genericos, presupuesto }: PropsTicket) {
  const completo = r.cobertura === 1;
  return (
    <article className="ticket-sombra imprimir" aria-label={`Ticket de ${r.comercio}`}>
      <div className="ticket px-5 pt-5">
        <p className="text-[13px] font-medium text-acento">{completo ? "Acá te sale más barata" : "El que tiene más de tu canasta"}</p>
        <h3 className="mt-1 text-xl leading-tight font-semibold tracking-tight">{r.comercio}</h3>
        <p className="mt-1 text-[13px] text-tinta-suave">
          {[r.direccion, `${km.format(r.distancia_km)} km`].filter(Boolean).join(", ")}
        </p>

        <div className="ticket-corte my-4" />
        <Lineas r={r} genericos={genericos} />
        <div className="ticket-corte my-4" />

        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[15px] font-semibold">Total</span>
          <NumberFlow value={r.total} locales="es-UY" format={FORMATO_TOTAL} className="numeros text-3xl font-semibold tracking-tight" />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Presupuesto r={r} presupuesto={presupuesto} />
          <span className="numeros ml-auto text-[12px] text-tinta-suave">Precios del {fecha(r.fecha_precios)}</span>
        </div>
      </div>
    </article>
  );
}

interface PropsFila extends PropsTicket {
  abierto: boolean;
  onAbrir: () => void;
}

/** Un comercio más en la lista; se abre para ver su ticket. */
export function TicketFila({ r, genericos, presupuesto, abierto, onAbrir }: PropsFila) {
  return (
    <li className="scroll-mt-4" data-establecimiento={r.establecimiento_id}>
      <button
        type="button"
        aria-expanded={abierto}
        onClick={onAbrir}
        className="presionable grid w-full grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-3 text-left"
      >
        <span className="min-w-0">
          <span className="block text-[15px] leading-snug font-medium">{r.comercio}</span>
          <span className="block text-[13px] text-tinta-suave">
            {km.format(r.distancia_km)} km, {r.cobertura === 1 ? "tiene todo" : `tiene ${r.productos_con_precio} de ${r.productos_pedidos}`}
          </span>
        </span>
        <span className="numeros text-[15px] font-medium">{formatoPlata(r.total)}</span>
        <CaretDown
          size={16}
          aria-hidden
          className={`text-tinta-suave transition-transform duration-200 ease-[var(--ease-salida)] ${abierto ? "rotate-180" : ""}`}
        />
      </button>
      {abierto && (
        <div className="imprimir px-4 pb-4">
          <div className="ticket-corte mb-3" />
          <Lineas r={r} genericos={genericos} />
          <div className="mt-3">
            <Presupuesto r={r} presupuesto={presupuesto} />
          </div>
        </div>
      )}
    </li>
  );
}
