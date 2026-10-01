import { ArrowClockwise, CheckCircle, EyeSlash, PencilSimple, Scissors, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import ReactCrop, { type Crop, convertToPixelCrop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

import { type LecturaBoleta, leerBoleta, type ProductoBoleta } from "../lib/boleta";
import { leerTexto } from "../lib/lectorBoleta";
import { ElegirFoto } from "./ElegirFoto";
import { RevisarProductos } from "./RevisarProductos";

type Estado =
  | { fase: "inicio" }
  | { fase: "recortar"; url: string }
  | { fase: "leyendo"; progreso: number }
  | { fase: "listo"; lectura: LecturaBoleta }
  | { fase: "error"; mensaje: string };

const botonPrincipal =
  "presionable inline-flex h-11 items-center gap-2 rounded-control bg-acento px-4 text-[15px] font-semibold text-sobre-acento disabled:opacity-50";
const botonSecundario =
  "presionable inline-flex h-10 items-center gap-1.5 rounded-control border border-linea bg-ticket px-3 text-sm font-medium text-tinta hover:border-tinta-suave";

/** Mini boleta de ejemplo: productos claros, datos de pago y personales tachados. */
function BoletaEjemplo() {
  return (
    <figure className="flex w-32 shrink-0 flex-col items-center gap-2 sm:w-36" aria-label="Ejemplo: solo la parte de los productos">
      <div className="ticket-sombra w-full rotate-2">
        <div className="ticket flex flex-col gap-1.5 px-3 pt-3" aria-hidden>
          <div className="h-2 w-16 rounded-full bg-linea" />
          <div className="-mx-1.5 flex flex-col gap-1.5 rounded-md px-1.5 py-1.5 ring-2 ring-acento">
            {[18, 14, 20, 12].map((ancho, i) => (
              <div key={i} className="flex justify-between">
                <div className="h-1.5 rounded-full bg-tinta/75" style={{ width: `${ancho * 4}px` }} />
                <div className="h-1.5 w-5 rounded-full bg-tinta/75" />
              </div>
            ))}
          </div>
          <div className="ticket-corte my-1" />
          {[16, 22].map((ancho, i) => (
            <div key={i} className="relative flex items-center">
              <div className="h-1.5 rounded-full bg-linea" style={{ width: `${ancho * 4}px` }} />
              <div className="absolute inset-x-0 top-1/2 h-[1.5px] -translate-y-1/2 bg-alerta" />
            </div>
          ))}
          <div className="h-2" />
        </div>
      </div>
      <figcaption className="text-center text-[12px] leading-tight font-medium text-acento">Solo los productos</figcaption>
    </figure>
  );
}

/** Opción 2: leer los productos y precios de la boleta, sin datos personales. */
export function OpcionBoleta({ onListo }: { onListo: (productos: ProductoBoleta[]) => void }) {
  const [estado, setEstado] = useState<Estado>({ fase: "inicio" });
  const [recorte, setRecorte] = useState<Crop>();
  const [recortePx, setRecortePx] = useState<PixelCrop>();
  const imagen = useRef<HTMLImageElement>(null);

  // La foto vive solo en memoria del navegador; al terminar se libera
  const url = estado.fase === "recortar" ? estado.url : null;
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  function alElegirFoto(archivo: File) {
    setEstado({ fase: "recortar", url: URL.createObjectURL(archivo) });
  }

  function alCargarImagen(e: React.SyntheticEvent<HTMLImageElement>) {
    // Propuesta inicial: la franja del medio, donde suelen estar los productos
    const inicial: Crop = { unit: "%", x: 4, y: 20, width: 92, height: 50 };
    setRecorte(inicial);
    setRecortePx(convertToPixelCrop(inicial, e.currentTarget.width, e.currentTarget.height));
  }

  async function leer() {
    if (!imagen.current || !recortePx?.width || !recortePx.height) return;
    const img = imagen.current;
    setEstado({ fase: "leyendo", progreso: 0 });
    try {
      // El recorte se marca sobre la foto achicada en pantalla: se pasa a píxeles de la original
      const escalaX = img.naturalWidth / img.width;
      const escalaY = img.naturalHeight / img.height;
      const recorte = {
        x: recortePx.x * escalaX,
        y: recortePx.y * escalaY,
        ancho: recortePx.width * escalaX,
        alto: recortePx.height * escalaY,
      };
      const texto = await leerTexto(img, recorte, (progreso) => setEstado({ fase: "leyendo", progreso }));
      const lectura = leerBoleta(texto);
      setEstado(
        lectura.productos.length
          ? { fase: "listo", lectura }
          : { fase: "error", mensaje: "No encontramos productos con precio. Probá recortando solo las líneas de productos, con buena luz." },
      );
    } catch {
      setEstado({ fase: "error", mensaje: "No pudimos leer la foto. Revisá tu conexión (la primera vez se descarga el lector) y probá de nuevo." });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <p className="min-w-0 flex-1 text-[14px] leading-snug text-tinta-suave">
          Sacale una foto a la boleta y recortá solo los productos. Así queda registrado qué compraste y a qué
          precio, y podés ver qué subió desde la última vez.
        </p>
        <BoletaEjemplo />
      </div>

      {estado.fase === "recortar" && (
        <div className="imprimir flex flex-col gap-3">
          <p className="flex items-center gap-1.5 text-[14px] font-medium">
            <Scissors size={18} className="text-acento" aria-hidden />
            Marcá solo la parte de los productos. Dejá afuera la tarjeta, tu nombre y tu cédula.
          </p>
          <p className="text-[12.5px] leading-snug text-tinta-suave">
            Se lee mejor con el ticket estirado, la foto de frente y con buena luz, sin sombras.
          </p>
          {/* La caja de la imagen tiene que medir lo mismo que la foto: si sobrara espacio, el
              recorte marcado no coincidiría con la parte que se lee */}
          <div className="flex justify-center overflow-hidden rounded-control border border-linea bg-panel">
            <ReactCrop
              crop={recorte}
              onChange={(px, pct) => {
                setRecorte(pct);
                setRecortePx(px);
              }}
              keepSelection
            >
              <img ref={imagen} src={estado.url} alt="Tu boleta" onLoad={alCargarImagen} className="block h-auto max-h-[60dvh] w-auto max-w-full" />
            </ReactCrop>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={botonPrincipal} onClick={leer}>
              <CheckCircle size={20} weight="bold" aria-hidden />
              Leer esta parte
            </button>
            <button type="button" className={botonSecundario} onClick={() => setEstado({ fase: "inicio" })}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {estado.fase === "leyendo" && (
        <div className="flex flex-col gap-2" aria-live="polite">
          <p className="text-[14px] font-medium">Leyendo tu boleta en el teléfono...</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-linea" aria-hidden>
            <div
              className="h-full origin-left rounded-full bg-acento transition-transform duration-200"
              style={{ transform: `scaleX(${estado.progreso})` }}
            />
          </div>
        </div>
      )}

      {estado.fase === "listo" && (
        <div className="imprimir flex flex-col gap-3" aria-live="polite">
          {estado.lectura.productos.length > 0 && (
            <p className="flex items-center gap-1.5 text-[14px] font-semibold text-acento">
              <CheckCircle size={18} weight="fill" aria-hidden />
              {estado.lectura.productos.length === 1
                ? "Encontramos 1 producto"
                : `Encontramos ${estado.lectura.productos.length} productos`}
            </p>
          )}
          {estado.lectura.quitadas > 0 && (
            <p className="flex gap-1.5 text-[13px] leading-snug text-tinta-suave">
              <EyeSlash size={16} className="mt-px shrink-0" aria-hidden />
              {estado.lectura.quitadas === 1
                ? "Borramos 1 línea que podía tener datos personales o de pago."
                : `Borramos ${estado.lectura.quitadas} líneas que podían tener datos personales o de pago.`}
            </p>
          )}
          <RevisarProductos iniciales={estado.lectura.productos} onConfirmar={onListo} />
          <div>
            <button type="button" className={botonSecundario} onClick={() => setEstado({ fase: "inicio" })}>
              <ArrowClockwise size={18} aria-hidden />
              Otra boleta
            </button>
          </div>
        </div>
      )}

      {(estado.fase === "inicio" || estado.fase === "error") && (
        <div className="flex flex-col gap-2">
          <ElegirFoto sacar="Sacar foto de la boleta" onArchivo={alElegirFoto} />
          {estado.fase === "error" && (
            <>
              <p className="flex gap-1.5 text-[13px] leading-snug text-alerta" role="alert">
                <WarningCircle size={16} className="mt-px shrink-0" aria-hidden />
                {estado.mensaje}
              </p>
              <div>
                <button
                  type="button"
                  className={botonSecundario}
                  onClick={() => setEstado({ fase: "listo", lectura: { productos: [], quitadas: 0 } })}
                >
                  <PencilSimple size={18} aria-hidden />
                  Escribirlos a mano
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
