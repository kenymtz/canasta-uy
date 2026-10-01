import { BookmarkSimple, FloppyDisk, X } from "@phosphor-icons/react";
import { type FormEvent, useState } from "react";

import type { Items, Lista } from "../store/canasta";

interface Props {
  listas: Lista[];
  items: Items;
  onGuardar: (nombre: string) => void;
  onCargar: (nombre: string) => void;
  onBorrar: (nombre: string) => void;
}

const botonSecundario =
  "presionable inline-flex h-10 items-center gap-1.5 rounded-control border border-linea bg-ticket px-3 text-sm font-medium text-tinta hover:border-tinta-suave";

function mismosItems(a: Items, b: Items) {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
}

const productos = (n: number) => (n === 1 ? "1 producto" : `${n} productos`);

export function MisListas({ listas, items, onGuardar, onCargar, onBorrar }: Props) {
  const [guardando, setGuardando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [aBorrar, setABorrar] = useState<string | null>(null);

  const cargada = listas.find((l) => mismosItems(l.items, items));
  const hayProductos = Object.keys(items).length > 0;
  const actualiza = listas.some((l) => l.nombre === nombre.trim());

  function abrirGuardar() {
    // Si la canasta salió de una lista, se propone su nombre para actualizarla
    setNombre(cargada?.nombre ?? "");
    setGuardando(true);
  }

  function guardar(e: FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    onGuardar(nombre);
    setGuardando(false);
  }

  return (
    <div className="flex flex-col gap-3">
      {listas.length === 0 ? (
        <p className="flex gap-2 text-sm leading-snug text-tinta-suave">
          <BookmarkSimple size={18} className="shrink-0" aria-hidden />
          Guardá tu compra de siempre como lista y la próxima vez la cargás con un toque.
        </p>
      ) : (
        <ul aria-label="Mis listas" className="-mx-5 flex gap-2.5 overflow-x-auto px-5 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
          {listas.map((l) => {
            const activa = cargada?.nombre === l.nombre;
            const cantidad = Object.keys(l.items).length;
            return (
              <li
                key={l.nombre}
                className={`relative flex w-44 shrink-0 flex-col rounded-caja border bg-ticket ${
                  activa ? "border-acento ring-1 ring-acento" : "border-linea"
                }`}
              >
                {aBorrar === l.nombre ? (
                  <div className="flex flex-col gap-2 p-3">
                    <p className="text-[13px] leading-snug">¿Borrar "{l.nombre}"?</p>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        className="presionable h-8 rounded-control bg-alerta px-2.5 text-[13px] font-semibold text-ticket"
                        onClick={() => {
                          onBorrar(l.nombre);
                          setABorrar(null);
                        }}
                      >
                        Borrar
                      </button>
                      <button type="button" className="presionable h-8 rounded-control px-2.5 text-[13px] font-medium" onClick={() => setABorrar(null)}>
                        No
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onCargar(l.nombre)}
                      aria-pressed={activa}
                      className="presionable flex flex-col items-start gap-1 p-3 pr-9 text-left"
                    >
                      <BookmarkSimple size={18} weight={activa ? "fill" : "regular"} className="text-acento" aria-hidden />
                      <span className="line-clamp-2 text-[14px] leading-snug font-semibold">{l.nombre}</span>
                      <span className="text-[12.5px] text-tinta-suave">{activa ? `Cargada, ${productos(cantidad)}` : productos(cantidad)}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Borrar la lista ${l.nombre}`}
                      onClick={() => setABorrar(l.nombre)}
                      className="presionable absolute top-2 right-2 inline-flex size-7 items-center justify-center rounded-full text-tinta-suave hover:bg-panel"
                    >
                      <X size={14} weight="bold" aria-hidden />
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {guardando ? (
        <form onSubmit={guardar} className="imprimir flex flex-col gap-2 rounded-caja border border-linea bg-ticket p-3">
          <label htmlFor="nombre-lista" className="text-sm font-medium text-tinta-suave">
            Nombre de la lista
          </label>
          <input
            id="nombre-lista"
            autoFocus
            maxLength={40}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="h-11 rounded-control border border-linea bg-panel px-3 text-[15px] outline-none focus-visible:border-acento"
          />
          <p className="text-[12.5px] text-tinta-suave">Por ejemplo: Compra del mes, Asado del domingo.</p>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!nombre.trim()}
              className="presionable h-10 rounded-control bg-acento px-3.5 text-sm font-semibold text-sobre-acento disabled:opacity-50"
            >
              {actualiza ? "Actualizar lista" : "Guardar lista"}
            </button>
            <button type="button" className="presionable h-10 rounded-control px-3 text-sm font-medium" onClick={() => setGuardando(false)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        hayProductos &&
        !cargada && (
          <div>
            <button type="button" className={botonSecundario} onClick={abrirGuardar}>
              <FloppyDisk size={18} aria-hidden />
              Guardar como lista
            </button>
          </div>
        )
      )}
    </div>
  );
}
