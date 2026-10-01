import { Camera, ImageSquare } from "@phosphor-icons/react";
import { useRef } from "react";

const botonPrincipal =
  "presionable inline-flex h-11 items-center gap-2 rounded-control bg-acento px-4 text-[15px] font-semibold text-sobre-acento disabled:opacity-50";
const botonSecundario =
  "presionable inline-flex h-11 items-center gap-1.5 rounded-control border border-linea bg-ticket px-3.5 text-[15px] font-medium text-tinta hover:border-tinta-suave disabled:opacity-50";

interface Props {
  /** Texto del botón de la cámara, por ejemplo "Escanear el QR" */
  sacar: string;
  onArchivo: (archivo: File) => void;
  deshabilitado?: boolean;
}

/**
 * Dos formas de dar la foto: sacarla en el momento (abre la cámara en el celular) o subir una
 * que ya está en el teléfono (una foto vieja o una captura de pantalla).
 */
export function ElegirFoto({ sacar, onArchivo, deshabilitado = false }: Props) {
  const camara = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);

  function alElegir(entrada: HTMLInputElement) {
    const archivo = entrada.files?.[0];
    entrada.value = ""; // permite elegir la misma foto otra vez
    if (archivo) onArchivo(archivo);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {/* capture="environment": en el celular abre directo la cámara de atrás */}
      <input
        ref={camara}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-entrada="camara"
        onChange={(e) => alElegir(e.currentTarget)}
      />
      {/* Sin capture: el celular ofrece la galería y los archivos */}
      <input
        ref={galeria}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-entrada="galeria"
        onChange={(e) => alElegir(e.currentTarget)}
      />
      <button type="button" className={botonPrincipal} disabled={deshabilitado} onClick={() => camara.current?.click()}>
        <Camera size={20} weight="bold" aria-hidden />
        {sacar}
      </button>
      <button type="button" className={botonSecundario} disabled={deshabilitado} onClick={() => galeria.current?.click()}>
        <ImageSquare size={20} aria-hidden />
        Subir una foto
      </button>
    </div>
  );
}
