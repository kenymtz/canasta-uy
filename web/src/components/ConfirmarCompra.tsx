import { Camera, FloppyDisk, MagnifyingGlass, QrCode, Storefront, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";

import { api, type Comercio } from "../lib/api";
import type { ProductoBoleta } from "../lib/boleta";
import { type Compra, type ComercioCompra, comercioSugerido, idCompra } from "../lib/compras";
import { formatoPlata, normalizar } from "../lib/formato";
import type { CompraQr } from "../lib/qrDgi";
import type { Ubicacion } from "../store/canasta";
import { useCompras } from "../store/compras";

export interface Borrador {
  qr: CompraQr | null;
  productos: ProductoBoleta[] | null;
}

interface Props {
  borrador: Borrador;
  ubicacion: Ubicacion | null;
  onIrA: (opcion: "qr" | "boleta") => void;
  onGuardada: (compra: Compra) => void;
  onDescartar: () => void;
}

const botonPrincipal =
  "presionable inline-flex h-11 items-center gap-2 rounded-control bg-acento px-4 text-[15px] font-semibold text-sobre-acento disabled:opacity-50";
const botonSecundario =
  "presionable inline-flex h-10 items-center gap-1.5 rounded-control border border-linea bg-ticket px-3 text-sm font-medium text-tinta hover:border-tinta-suave";
const enlace = "presionable inline-flex items-center gap-1 font-medium text-acento underline underline-offset-2";

const RADIO_COMERCIOS_KM = 15;
const VISIBLES = 6;

function hoy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function aComercioCompra(c: Comercio): ComercioCompra {
  return { establecimiento_id: c.establecimiento_id, nombre: c.nombre, direccion: c.direccion, ciudad: c.ciudad };
}

/** El RUC dice qué empresa es, no qué sucursal: el usuario elige entre los comercios cercanos. */
function ElegirComercio({
  ubicacion,
  elegido,
  onElegir,
}: {
  ubicacion: Ubicacion | null;
  /** undefined: todavía no eligió; null: eligió "no está en la lista" */
  elegido: ComercioCompra | null | undefined;
  onElegir: (c: ComercioCompra | null) => void;
}) {
  const [cercanos, setCercanos] = useState<Comercio[]>([]);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    if (!ubicacion) return;
    let vigente = true;
    api
      .comercios(ubicacion.lat, ubicacion.lon, RADIO_COMERCIOS_KM)
      .then((c) => vigente && setCercanos(c))
      .catch(() => vigente && setCercanos([]));
    return () => {
      vigente = false;
    };
  }, [ubicacion]);

  const visibles = useMemo(() => {
    const texto = normalizar(busqueda.trim());
    const filtrados = texto
      ? cercanos.filter((c) => normalizar(`${c.nombre} ${c.cadena ?? ""} ${c.direccion ?? ""}`).includes(texto))
      : cercanos;
    const lista = filtrados.slice(0, VISIBLES);
    // El elegido (por ejemplo, el sugerido por el historial) siempre se ve
    if (elegido && !lista.some((c) => c.establecimiento_id === elegido.establecimiento_id)) {
      const completo = cercanos.find((c) => c.establecimiento_id === elegido.establecimiento_id);
      if (completo) lista.unshift(completo);
    }
    return lista;
  }, [cercanos, busqueda, elegido]);

  if (!ubicacion) {
    return (
      <p className="text-[13px] leading-snug text-tinta-suave">
        Elegí tu ciudad arriba, en <strong className="font-medium text-tinta">Dónde estás</strong>, y te mostramos los
        comercios cercanos para que marques dónde compraste. También podés guardarla sin comercio.
      </p>
    );
  }

  const opcion = (id: string, activo: boolean, titulo: string, detalle: string | null, alElegir: () => void) => (
    <label
      key={id}
      className={`presionable flex cursor-pointer items-start gap-2.5 rounded-control border px-3 py-2 ${
        activo ? "border-acento bg-acento-suave" : "border-linea bg-ticket hover:border-tinta-suave"
      }`}
    >
      <input type="radio" name="comercio-compra" checked={activo} onChange={alElegir} className="mt-1 accent-[var(--color-acento)]" />
      <span className="min-w-0">
        <span className="block text-[14px] leading-snug font-medium">{titulo}</span>
        {detalle && <span className="block text-[12.5px] text-tinta-suave">{detalle}</span>}
      </span>
    </label>
  );

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium text-tinta-suave">¿En qué comercio?</legend>
      <div className="relative">
        <MagnifyingGlass size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-tinta-suave" aria-hidden />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o dirección"
          aria-label="Buscar comercio"
          className="h-10 w-full rounded-control border border-linea bg-ticket pr-3 pl-9 text-[14px] outline-none focus-visible:border-acento"
        />
      </div>
      {visibles.map((c) =>
        opcion(
          String(c.establecimiento_id),
          elegido?.establecimiento_id === c.establecimiento_id,
          c.nombre,
          [c.direccion, `${c.distancia_km.toLocaleString("es-UY")} km`].filter(Boolean).join(" · "),
          () => onElegir(aComercioCompra(c)),
        ),
      )}
      {opcion("ninguno", elegido === null, "No está en la lista", "Se guarda igual, sin comercio", () => onElegir(null))}
    </fieldset>
  );
}

/** Junta lo leído del QR y de la boleta en una compra, y la guarda en "Mis compras". */
export function ConfirmarCompra({ borrador, ubicacion, onIrA, onGuardada, onDescartar }: Props) {
  const { compras, guardar } = useCompras();
  const { qr, productos } = borrador;
  const [comercio, setComercio] = useState<ComercioCompra | null | undefined>(
    () => comercioSugerido(compras, qr?.ruc ?? null) ?? undefined,
  );
  const [fechaManual, setFechaManual] = useState(hoy);
  const [repetida, setRepetida] = useState(false);

  // Si después se escanea el QR, se propone el comercio que se eligió antes para esa empresa
  const ruc = qr?.ruc ?? null;
  useEffect(() => {
    const sugerido = comercioSugerido(useCompras.getState().compras, ruc);
    if (sugerido) setComercio(sugerido);
  }, [ruc]);

  const sumaProductos = (productos ?? []).reduce((suma, p) => suma + p.precio, 0);
  const total = qr?.monto ?? Math.round(sumaProductos * 100) / 100;
  const fecha = qr?.fecha ?? fechaManual;

  // Con ubicación hay que marcar el comercio (o "no está en la lista"); sin ubicación, no se puede
  const faltaComercio = ubicacion !== null && comercio === undefined;

  function alGuardar() {
    const compra: Compra = {
      id: idCompra(qr),
      fecha,
      total,
      ruc: qr?.ruc ?? null,
      comercio: comercio ?? null,
      productos: productos ?? [],
      guardada: new Date().toISOString(),
    };
    if (guardar(compra)) onGuardada(compra);
    else setRepetida(true);
  }

  return (
    <div className="imprimir flex flex-col gap-4 rounded-caja border border-acento/40 bg-panel p-4" aria-live="polite">
      <div className="flex items-center gap-2">
        <Storefront size={20} className="text-acento" aria-hidden />
        <h3 className="text-[15px] font-semibold">Tu compra</h3>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-[13px]">
        <div className="flex flex-col gap-0.5">
          <dt className="text-tinta-suave">Fecha</dt>
          <dd>
            {qr ? (
              <span className="numeros font-medium">{fecha.split("-").reverse().join("/")}</span>
            ) : (
              <input
                type="date"
                value={fechaManual}
                max={hoy()}
                onChange={(e) => e.target.value && setFechaManual(e.target.value)}
                aria-label="Fecha de la compra"
                className="numeros h-8 w-full rounded-[8px] border border-linea bg-ticket px-1.5 text-[13px]"
              />
            )}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-tinta-suave">{qr ? "Total" : "Suma de productos"}</dt>
          <dd className="numeros font-medium">{formatoPlata(total)}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-tinta-suave">Productos</dt>
          <dd className="numeros font-medium">{productos ? productos.length : "—"}</dd>
        </div>
      </dl>

      {qr && productos && Math.abs(sumaProductos - qr.monto) > Math.max(1, qr.monto * 0.02) && (
        <p className="flex gap-1.5 text-[13px] leading-snug text-tinta" role="status">
          <WarningCircle size={16} className="mt-px shrink-0 text-alerta" aria-hidden />
          <span>
            Los productos suman <strong className="numeros font-medium">{formatoPlata(sumaProductos)}</strong> y el ticket
            dice <strong className="numeros font-medium">{formatoPlata(qr.monto)}</strong>. Puede que falte alguno o que
            un precio se haya leído mal: podés corregirlos en <strong className="font-medium">Leer la boleta</strong>.
          </span>
        </p>
      )}
      {!productos && (
        <p className="flex flex-wrap items-center gap-x-1.5 text-[13px] leading-snug text-tinta-suave">
          <Camera size={16} aria-hidden />
          ¿Querés registrar también qué compraste?
          <button type="button" className={enlace} onClick={() => onIrA("boleta")}>
            Leé la boleta
          </button>
        </p>
      )}
      {!qr && (
        <p className="flex flex-wrap items-center gap-x-1.5 text-[13px] leading-snug text-tinta-suave">
          <QrCode size={16} aria-hidden />
          Con el QR del ticket tomamos la fecha y el total exactos.
          <button type="button" className={enlace} onClick={() => onIrA("qr")}>
            Escanealo
          </button>
        </p>
      )}

      <ElegirComercio ubicacion={ubicacion} elegido={comercio} onElegir={setComercio} />

      {faltaComercio && <p className="text-[13px] text-tinta-suave">Marcá el comercio para guardarla.</p>}
      {repetida && (
        <p className="text-[13px] font-medium text-alerta" role="alert">
          Este ticket ya está en tus compras.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" className={botonPrincipal} onClick={alGuardar} disabled={repetida || faltaComercio}>
          <FloppyDisk size={18} weight="bold" aria-hidden />
          Guardar en Mis compras
        </button>
        <button type="button" className={botonSecundario} onClick={onDescartar}>
          Descartar
        </button>
      </div>
    </div>
  );
}
