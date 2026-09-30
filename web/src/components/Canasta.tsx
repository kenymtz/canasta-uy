import NumberFlow from "@number-flow/react";
import { MagnifyingGlass, Minus, Plus, Trash } from "@phosphor-icons/react";
import { useMemo, useState } from "react";

import type { Generico } from "../lib/api";
import { IconoCategoria } from "../lib/categorias";
import { normalizar, partesCantidad } from "../lib/formato";
import type { Lista } from "../store/canasta";
import { MisListas } from "./MisListas";

const TU_CANASTA = "Tu canasta";

interface Props {
  genericos: Generico[];
  items: Record<number, number>;
  presupuesto: number | null;
  listas: Lista[];
  onSumar: (g: Generico) => void;
  onRestar: (g: Generico) => void;
  onVaciar: () => void;
  onPresupuesto: (monto: number | null) => void;
  onGuardarLista: (nombre: string) => void;
  onCargarLista: (nombre: string) => void;
  onBorrarLista: (nombre: string) => void;
}

const botonSecundario =
  "presionable inline-flex h-10 items-center gap-1.5 rounded-control border border-linea bg-ticket px-3 text-sm font-medium text-tinta hover:border-tinta-suave";
const botonRedondo =
  "presionable inline-flex size-11 items-center justify-center rounded-control border border-linea bg-ticket text-tinta hover:border-tinta-suave";

function pista(g: Generico): string {
  if (g.se_vende_suelto) return "suelto, por kilo";
  return { kg: "por peso", l: "por litro", unidad: "por unidad", m: "por metro" }[g.unidad_base];
}

/** La cantidad con los números que giran como en una caja registradora. */
function Cantidad({ cantidad, g }: { cantidad: number; g: Generico }) {
  const { valor, sufijo } = partesCantidad(cantidad, g.unidad_base);
  return (
    <span className="numeros inline-flex w-16 items-baseline justify-center gap-1 text-sm font-medium" aria-live="polite">
      <NumberFlow value={valor} locales="es-UY" format={{ maximumFractionDigits: 2 }} />
      <span>{sufijo}</span>
    </span>
  );
}

export function Canasta(p: Props) {
  const { genericos, items } = p;
  const cantidadItems = Object.keys(items).length;
  const categorias = useMemo(() => [...new Set(genericos.map((g) => g.categoria))], [genericos]);
  const [categoria, setCategoria] = useState<string>(cantidadItems > 0 ? TU_CANASTA : "Almacén");
  const [busqueda, setBusqueda] = useState("");

  const visibles = useMemo(() => {
    const texto = normalizar(busqueda.trim());
    if (texto) return genericos.filter((g) => normalizar(g.nombre).includes(texto));
    if (categoria === TU_CANASTA) return genericos.filter((g) => g.producto_canonico_id in items);
    return genericos.filter((g) => g.categoria === categoria);
  }, [genericos, busqueda, categoria, items]);

  return (
    <section aria-labelledby="titulo-que" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="titulo-que" className="text-lg font-semibold tracking-tight">
          Qué vas a comprar
        </h2>
        {cantidadItems > 0 && (
          <button type="button" className={botonSecundario} onClick={p.onVaciar}>
            <Trash size={18} aria-hidden />
            Vaciar
          </button>
        )}
      </div>

      <MisListas
        listas={p.listas}
        items={items}
        onGuardar={p.onGuardarLista}
        onCargar={(nombre) => {
          p.onCargarLista(nombre);
          setBusqueda("");
          setCategoria(TU_CANASTA);
        }}
        onBorrar={p.onBorrarLista}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="buscar" className="text-sm font-medium text-tinta-suave">
          Buscar un producto
        </label>
        <div className="relative">
          <MagnifyingGlass size={18} aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-tinta-suave" />
          <input
            id="buscar"
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="h-11 w-full rounded-control border border-linea bg-ticket pr-3 pl-10 text-[15px] outline-none focus-visible:border-acento"
          />
        </div>
      </div>

      {!busqueda && (
        <div role="tablist" aria-label="Categorías" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
          {[TU_CANASTA, ...categorias].map((c) => {
            const activa = c === categoria;
            return (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={activa}
                onClick={() => setCategoria(c)}
                className={`presionable inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full pr-3.5 pl-2.5 text-sm font-medium whitespace-nowrap ${
                  activa ? "bg-tinta text-panel" : "border border-linea bg-ticket text-tinta hover:border-tinta-suave"
                }`}
              >
                <span className={activa ? "" : "text-acento"}>
                  <IconoCategoria categoria={c} size={17} />
                </span>
                {c === TU_CANASTA ? `${TU_CANASTA} (${cantidadItems})` : c}
              </button>
            );
          })}
        </div>
      )}

      {visibles.length === 0 ? (
        <p className="rounded-caja border border-dashed border-linea px-4 py-6 text-center text-sm text-tinta-suave">
          {busqueda
            ? `No encontramos "${busqueda}". Probá con otra palabra.`
            : "Tu canasta está vacía. Elegí una categoría o cargá una de tus listas."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-linea rounded-caja border border-linea bg-ticket">
          {visibles.map((g) => {
            const cantidad = items[g.producto_canonico_id];
            const elegido = cantidad !== undefined;
            return (
              <li key={g.producto_canonico_id} className="flex items-center gap-3 px-3 py-2.5">
                <span
                  className={`inline-flex size-9 shrink-0 items-center justify-center rounded-control transition-colors duration-200 ${
                    elegido ? "bg-acento text-sobre-acento" : "bg-acento-suave text-acento"
                  }`}
                >
                  <IconoCategoria categoria={g.categoria} size={19} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] leading-snug font-medium text-pretty">{g.nombre}</p>
                  <p className="text-[13px] text-tinta-suave">{pista(g)}</p>
                </div>
                {elegido ? (
                  <div className="aparecer flex shrink-0 items-center">
                    <button type="button" className={botonRedondo} aria-label={`Menos ${g.nombre}`} onClick={() => p.onRestar(g)}>
                      <Minus size={18} weight="bold" aria-hidden />
                    </button>
                    <Cantidad cantidad={cantidad} g={g} />
                    <button type="button" className={botonRedondo} aria-label={`Más ${g.nombre}`} onClick={() => p.onSumar(g)}>
                      <Plus size={18} weight="bold" aria-hidden />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={`${botonRedondo} text-acento`}
                    aria-label={`Agregar ${g.nombre}`}
                    onClick={() => p.onSumar(g)}
                  >
                    <Plus size={18} weight="bold" aria-hidden />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="presupuesto" className="text-sm font-medium text-tinta-suave">
          Tu presupuesto (opcional)
        </label>
        <div className="relative">
          <span className="numeros pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-tinta-suave">$</span>
          <input
            id="presupuesto"
            type="number"
            inputMode="numeric"
            min={0}
            step={100}
            value={p.presupuesto ?? ""}
            onChange={(e) => p.onPresupuesto(e.target.value ? Number(e.target.value) : null)}
            className="numeros h-11 w-full rounded-control border border-linea bg-ticket pr-3 pl-8 text-[15px] outline-none focus-visible:border-acento"
          />
        </div>
      </div>
    </section>
  );
}
