import { ArrowClockwise, Camera, CheckCircle, QrCode, WarningCircle } from "@phosphor-icons/react";
import jsQR from "jsqr";
import { useRef, useState } from "react";

import { formatoPlata } from "../lib/formato";
import { type CompraQr, leerQrDgi } from "../lib/qrDgi";

type Estado =
  | { fase: "inicio" }
  | { fase: "leyendo" }
  | { fase: "leido"; compra: CompraQr }
  | { fase: "error"; mensaje: string };

const botonPrincipal =
  "presionable inline-flex h-11 items-center gap-2 rounded-control bg-acento px-4 text-[15px] font-semibold text-sobre-acento";
const botonSecundario =
  "presionable inline-flex h-10 items-center gap-1.5 rounded-control border border-linea bg-ticket px-3 text-sm font-medium text-tinta hover:border-tinta-suave";

/** Busca un QR en la foto, en el navegador: la imagen no se manda a ningún lado. */
async function leerQrDeFoto(archivo: File): Promise<string | null> {
  const imagen = await createImageBitmap(archivo);
  const escala = Math.min(1, 1600 / Math.max(imagen.width, imagen.height)); // fotos enormes, más lentas
  const ancho = Math.round(imagen.width * escala);
  const alto = Math.round(imagen.height * escala);
  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(imagen, 0, 0, ancho, alto);
  return jsQR(ctx.getImageData(0, 0, ancho, alto).data, ancho, alto)?.data ?? null;
}

function fecha(iso: string) {
  const [anio, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${anio}`;
}

/** Mini ticket de ejemplo: los productos borroneados y el QR resaltado, que es lo único que se lee. */
function TicketEjemplo() {
  return (
    <figure className="flex w-32 shrink-0 flex-col items-center gap-2 sm:w-36" aria-label="Ejemplo: el código QR está al pie del ticket">
      <div className="ticket-sombra w-full -rotate-2">
        <div className="ticket flex flex-col gap-1.5 px-3 pt-3" aria-hidden>
          <div className="h-2 w-16 rounded-full bg-tinta/70" />
          <div className="h-1.5 w-20 rounded-full bg-linea" />
          <div className="ticket-corte my-1" />
          {[18, 14, 20, 12].map((ancho, i) => (
            <div key={i} className="flex justify-between opacity-60 blur-[1.2px]">
              <div className="h-1.5 rounded-full bg-tinta-suave" style={{ width: `${ancho * 4}px` }} />
              <div className="h-1.5 w-5 rounded-full bg-tinta-suave" />
            </div>
          ))}
          <div className="ticket-corte my-1" />
          <div className="mx-auto mt-1 mb-1 rounded-md p-0.5 text-tinta ring-2 ring-acento ring-offset-2 ring-offset-ticket">
            <QrCode size={52} weight="regular" />
          </div>
        </div>
      </div>
      <figcaption className="text-center text-[12px] leading-tight font-medium text-acento">Solo este código</figcaption>
    </figure>
  );
}

/** Opción 1: leer solo el QR (comercio, fecha y total). */
export function OpcionQr({ onLeido }: { onLeido: (compra: CompraQr) => void }) {
  const [estado, setEstado] = useState<Estado>({ fase: "inicio" });
  const entrada = useRef<HTMLInputElement>(null);

  async function alElegirFoto(archivo: File | undefined) {
    if (!archivo) return;
    setEstado({ fase: "leyendo" });
    try {
      const texto = await leerQrDeFoto(archivo);
      if (!texto) {
        setEstado({ fase: "error", mensaje: "No encontramos un código QR en la foto. Probá con más luz y el código entero." });
        return;
      }
      const compra = leerQrDgi(texto);
      setEstado(
        compra
          ? { fase: "leido", compra }
          : { fase: "error", mensaje: "Ese código no es de un ticket de la DGI. Buscá el QR que está al pie del ticket." },
      );
      if (compra) onLeido(compra);
    } catch {
      setEstado({ fase: "error", mensaje: "No pudimos abrir la foto. Probá con otra." });
    } finally {
      if (entrada.current) entrada.current.value = ""; // permite elegir la misma foto otra vez
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <p className="min-w-0 flex-1 text-[14px] leading-snug text-tinta-suave">
          Escaneá el QR que está al pie del ticket. Nos dice en qué comercio compraste, cuándo y cuánto gastaste, y
          lo guardamos en tus compras.
        </p>
        <TicketEjemplo />
      </div>

      <input
        ref={entrada}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => alElegirFoto(e.target.files?.[0])}
      />

      {estado.fase === "leido" ? (
        <div className="imprimir flex flex-col gap-3" aria-live="polite">
          <p className="flex items-center gap-1.5 text-[14px] font-semibold text-acento">
            <CheckCircle size={18} weight="fill" aria-hidden />
            Leímos tu {estado.compra.tipo}
          </p>
          <dl className="grid grid-cols-3 gap-2 text-[13px]">
            {[
              ["Comercio (RUC)", estado.compra.ruc],
              ["Fecha", fecha(estado.compra.fecha)],
              ["Total", formatoPlata(estado.compra.monto)],
            ].map(([etiqueta, valor]) => (
              <div key={etiqueta} className="flex flex-col gap-0.5">
                <dt className="text-tinta-suave">{etiqueta}</dt>
                <dd className="numeros font-medium break-all">{valor}</dd>
              </div>
            ))}
          </dl>
          <div>
            <button type="button" className={botonSecundario} onClick={() => entrada.current?.click()}>
              <ArrowClockwise size={18} aria-hidden />
              Escanear otro
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div>
            <button type="button" className={botonPrincipal} disabled={estado.fase === "leyendo"} onClick={() => entrada.current?.click()}>
              <Camera size={20} weight="bold" aria-hidden />
              {estado.fase === "leyendo" ? "Leyendo el código..." : "Escanear el QR"}
            </button>
          </div>
          {estado.fase === "error" && (
            <p className="flex gap-1.5 text-[13px] leading-snug text-alerta" role="alert">
              <WarningCircle size={16} className="mt-px shrink-0" aria-hidden />
              {estado.mensaje}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
