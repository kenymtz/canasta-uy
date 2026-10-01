import { ArrowDown, ArrowUp, CaretDown, Receipt, Trash } from "@phosphor-icons/react";
import { useState } from "react";

import { anterior, cambiosDePrecio, type Compra, diferencia, ordenar } from "../lib/compras";
import { formatoPlata } from "../lib/formato";
import { useCompras } from "../store/compras";
import { Cuenta } from "./Cuenta";

const porcentaje = (n: number) => `${Math.abs(Math.round(n * 100)).toLocaleString("es-UY")} %`;
const fechaCorta = (iso: string) => iso.split("-").reverse().join("/");

function donde(c: Compra): string {
  if (c.comercio) return c.comercio.nombre;
  return c.ruc ? `Comercio con RUC ${c.ruc}` : "Comercio sin indicar";
}

/** "+ $ 120 (12 %)" en rojo si gastó más, en verde si gastó menos. */
function Diferencia({ compra, previa }: { compra: Compra; previa: Compra }) {
  const { monto, cambio } = diferencia(compra, previa);
  if (monto === 0) return <span className="text-tinta-suave">Igual que la anterior</span>;
  const mas = monto > 0;
  const Flecha = mas ? ArrowUp : ArrowDown;
  return (
    <span className={`font-medium ${mas ? "text-alerta" : "text-acento"}`}>
      {/* El monto y el porcentaje no se separan; "vs. la anterior" puede bajar entero */}
      <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
        <Flecha size={13} weight="bold" aria-hidden />
        <span className="sr-only">{mas ? "Gastaste más:" : "Gastaste menos:"}</span>
        <span className="numeros">
          {formatoPlata(Math.abs(monto))} ({porcentaje(cambio)})
        </span>
      </span>{" "}
      <span className="font-normal whitespace-nowrap text-tinta-suave">vs. la anterior</span>
    </span>
  );
}

function FilaCompra({ compra, compras }: { compra: Compra; compras: Compra[] }) {
  const [abierta, setAbierta] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const borrar = useCompras((s) => s.borrar);
  const previa = anterior(compras, compra);
  const cambios = new Map(cambiosDePrecio(compras, compra).map((c) => [c.descripcion, c]));

  return (
    <li className="flex flex-col">
      <button
        type="button"
        onClick={() => setAbierta(!abierta)}
        aria-expanded={abierta}
        className="presionable grid w-full grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-2.5 text-left"
      >
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-medium">{donde(compra)}</span>
          <span className="block text-[12.5px] text-tinta-suave">
            <span className="numeros">{fechaCorta(compra.fecha)}</span>
            {compra.productos.length > 0 && ` · ${compra.productos.length} productos`}
          </span>
          {previa && (
            <span className="block text-[12.5px]">
              <Diferencia compra={compra} previa={previa} />
            </span>
          )}
        </span>
        <span className="numeros text-[15px] font-semibold">{formatoPlata(compra.total)}</span>
        <CaretDown size={16} className={`text-tinta-suave transition-transform duration-200 ${abierta ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {abierta && (
        <div className="aparecer flex flex-col gap-3 px-3 pb-3">
          {compra.comercio?.direccion && (
            <p className="text-[12.5px] text-tinta-suave">
              {compra.comercio.direccion}
              {compra.comercio.ciudad && `, ${compra.comercio.ciudad}`}
            </p>
          )}
          {compra.productos.length > 0 ? (
            <ul className="flex flex-col gap-1.5 rounded-control border border-dashed border-linea bg-panel px-3 py-2.5">
              {compra.productos.map((p, i) => {
                const cambio = cambios.get(p.descripcion);
                return (
                  <li key={i} className="flex justify-between gap-3 text-[13px]">
                    <span className="min-w-0">{p.descripcion}</span>
                    <span className="flex shrink-0 items-baseline gap-1.5">
                      {cambio && (
                        <span className={`numeros text-[12px] font-medium ${cambio.cambio > 0 ? "text-alerta" : "text-acento"}`}>
                          {cambio.cambio > 0 ? "▲" : "▼"} {porcentaje(cambio.cambio)}
                          <span className="sr-only"> desde la última vez ({formatoPlata(cambio.antes)})</span>
                        </span>
                      )}
                      <span className="numeros">{formatoPlata(p.precio)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-[12.5px] text-tinta-suave">Sin detalle de productos: se guardó solo el QR.</p>
          )}
          {borrando ? (
            <div className="flex items-center gap-2 text-[13px]">
              <span>¿Borrar esta compra?</span>
              <button
                type="button"
                className="presionable h-8 rounded-control bg-alerta px-2.5 font-semibold text-ticket"
                onClick={() => borrar(compra.id)}
              >
                Borrar
              </button>
              <button type="button" className="presionable h-8 rounded-control px-2.5 font-medium" onClick={() => setBorrando(false)}>
                No
              </button>
            </div>
          ) : (
            <div>
              <button
                type="button"
                className="presionable inline-flex h-8 items-center gap-1.5 rounded-control px-2 text-[13px] font-medium text-tinta-suave hover:text-alerta"
                onClick={() => setBorrando(true)}
              >
                <Trash size={15} aria-hidden />
                Borrar
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export function MisCompras() {
  const compras = useCompras((s) => s.compras);
  if (compras.length === 0) return null;
  const lista = ordenar(compras);

  return (
    <section aria-labelledby="titulo-compras" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="titulo-compras" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Receipt size={20} className="text-acento" aria-hidden />
          Mis compras
        </h2>
        <span className="numeros text-[13px] text-tinta-suave">{compras.length === 1 ? "1 compra" : `${compras.length} compras`}</span>
      </div>
      <ul className="flex flex-col divide-y divide-linea rounded-caja border border-linea bg-ticket">
        {lista.map((c) => (
          <FilaCompra key={c.id} compra={c} compras={compras} />
        ))}
      </ul>
      <Cuenta />
    </section>
  );
}
