import { Check, ListPlus, Plus, X } from "@phosphor-icons/react";
import { useState } from "react";

import type { ProductoBoleta } from "../lib/boleta";
import { formatoPlata } from "../lib/formato";

interface Fila {
  clave: number;
  descripcion: string;
  precio: string; // como lo escribe la persona: "45,28" o "45.28"
}

const botonPrincipal =
  "presionable inline-flex h-11 items-center gap-2 rounded-control bg-acento px-4 text-[15px] font-semibold text-sobre-acento disabled:opacity-50";
const campo =
  "h-9 min-w-0 rounded-[8px] border border-linea bg-ticket px-2 text-[13.5px] outline-none focus-visible:border-acento";

let siguiente = 0;
const nuevaFila = (descripcion = "", precio = ""): Fila => ({ clave: siguiente++, descripcion, precio });

/** "1.250,50" o "1250.5" → 1250.5; vacío o inválido → NaN */
function aPrecio(texto: string): number {
  const limpio = texto.trim().replace(/\s/g, "");
  if (!limpio) return NaN;
  // Si tiene coma, la coma es el decimal y los puntos son miles; si no, el punto es el decimal
  return Number(limpio.includes(",") ? limpio.replace(/\./g, "").replace(",", ".") : limpio);
}

function aProductos(filas: Fila[]): ProductoBoleta[] {
  return filas
    .map((f) => ({ descripcion: f.descripcion.trim(), precio: Math.round(aPrecio(f.precio) * 100) / 100 }))
    .filter((p) => p.descripcion && Number.isFinite(p.precio) && p.precio > 0);
}

/**
 * La lectura de la foto es un borrador: la persona corrige nombres y precios, borra lo que
 * no es un producto y agrega lo que faltó, antes de sumarlo a su compra.
 */
export function RevisarProductos({
  iniciales,
  onConfirmar,
}: {
  iniciales: ProductoBoleta[];
  onConfirmar: (productos: ProductoBoleta[]) => void;
}) {
  // Sin nada leído (o para escribirlos a mano) se arranca con un renglón vacío
  const [filas, setFilas] = useState<Fila[]>(() =>
    iniciales.length
      ? iniciales.map((p) => nuevaFila(p.descripcion, p.precio.toFixed(2).replace(".", ",")))
      : [nuevaFila()],
  );
  const [confirmado, setConfirmado] = useState<string | null>(null);

  const productos = aProductos(filas);
  const suma = productos.reduce((t, p) => t + p.precio, 0);
  const firma = JSON.stringify(productos);
  const alDia = confirmado === firma;

  const cambiar = (clave: number, cambios: Partial<Fila>) =>
    setFilas((actuales) => actuales.map((f) => (f.clave === clave ? { ...f, ...cambios } : f)));

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-control border border-dashed border-linea bg-panel px-3 py-2.5">
        <p className="mb-2 text-[12.5px] leading-snug text-tinta-suave">
          <strong className="font-medium text-tinta">Revisá antes de guardar:</strong> el lector puede equivocarse.
          Corregí lo que esté mal, borrá lo que no sea un producto y agregá lo que falte.
        </p>
        <ul className="flex flex-col gap-1.5">
          {filas.map((f, i) => (
            <li key={f.clave} className="flex items-center gap-1.5">
              <input
                value={f.descripcion}
                onChange={(e) => cambiar(f.clave, { descripcion: e.target.value })}
                aria-label={`Producto ${i + 1}`}
                placeholder="Producto"
                maxLength={80}
                className={`${campo} flex-1`}
              />
              <div className="relative w-24 shrink-0">
                <span className="numeros pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-[13px] text-tinta-suave">$</span>
                <input
                  value={f.precio}
                  onChange={(e) => cambiar(f.clave, { precio: e.target.value })}
                  inputMode="decimal"
                  aria-label={`Precio del producto ${i + 1}`}
                  placeholder="0,00"
                  className={`${campo} numeros w-full pl-5 text-right ${f.precio && !(aPrecio(f.precio) > 0) ? "border-alerta" : ""}`}
                />
              </div>
              <button
                type="button"
                aria-label={`Borrar ${f.descripcion || `producto ${i + 1}`}`}
                onClick={() => setFilas((actuales) => actuales.filter((x) => x.clave !== f.clave))}
                className="presionable inline-flex size-8 shrink-0 items-center justify-center rounded-full text-tinta-suave hover:bg-ticket hover:text-alerta"
              >
                <X size={14} weight="bold" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setFilas((actuales) => [...actuales, nuevaFila()])}
            className="presionable inline-flex h-8 items-center gap-1 rounded-control px-1.5 text-[13px] font-medium text-acento"
          >
            <Plus size={14} weight="bold" aria-hidden />
            Agregar producto
          </button>
          <span className="numeros text-[13px] text-tinta-suave">Suma: {formatoPlata(suma)}</span>
        </div>
      </div>

      <div>
        <button
          type="button"
          className={botonPrincipal}
          disabled={productos.length === 0 || alDia}
          onClick={() => {
            onConfirmar(productos);
            setConfirmado(firma);
          }}
        >
          {alDia ? <Check size={18} weight="bold" aria-hidden /> : <ListPlus size={18} weight="bold" aria-hidden />}
          {alDia ? "Sumados a tu compra" : confirmado ? "Actualizar mi compra" : "Sumar a mi compra"}
        </button>
      </div>
    </div>
  );
}
