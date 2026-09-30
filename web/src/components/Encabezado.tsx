import { Moon, Receipt, Sun } from "@phosphor-icons/react";

import { useTema } from "../lib/tema";

interface Props {
  /** Fecha del último precio (AAAA-MM-DD), o null mientras carga */
  ultimoPrecio: string | null;
  comercios: number;
  productos: number;
  departamentos: number;
}

function fechaLegible(iso: string): string {
  const [anio, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${anio}`;
}

const miles = new Intl.NumberFormat("es-UY");

/** Sol o luna: muestra el modo al que se pasa al tocarlo. */
function BotonTema() {
  const { tema, alternar } = useTema();
  const oscuro = tema === "oscuro";
  const accion = oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={accion}
      title={accion}
      className="presionable relative inline-flex size-10 items-center justify-center rounded-full border border-linea bg-ticket text-tinta hover:border-tinta-suave"
    >
      <Moon size={19} weight="bold" aria-hidden className={`icono-tema ${oscuro ? "oculto" : ""}`} />
      <Sun size={19} weight="bold" aria-hidden className={`icono-tema ${oscuro ? "" : "oculto"}`} />
    </button>
  );
}

export function Encabezado({ ultimoPrecio, comercios, productos, departamentos }: Props) {
  // Talón del ticket con datos reales: cuánto cubre la web y de cuándo son los precios
  const datos: Array<[string, string]> = [
    [comercios ? miles.format(comercios) : "…", "comercios"],
    [productos ? String(productos) : "…", "productos"],
    [departamentos ? String(departamentos) : "…", "departamentos"],
    [ultimoPrecio ? fechaLegible(ultimoPrecio) : "…", "precios del SIPC"],
  ];

  return (
    <header className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-acento">
          <Receipt size={22} weight="bold" aria-hidden />
          <span className="text-[15px] font-semibold tracking-tight text-tinta">Canasta UY</span>
        </div>
        <BotonTema />
      </div>
      <h1 className="text-[28px] leading-[1.1] font-semibold tracking-tight text-balance sm:text-[32px]">
        ¿Dónde te sale <mark className="resaltado">más barata</mark> la compra?
      </h1>
      <dl className="grid grid-cols-2 overflow-hidden rounded-control border border-dashed border-linea">
        {datos.map(([valor, etiqueta]) => (
          <div
            key={etiqueta}
            className="flex flex-col gap-0.5 border-dashed border-linea px-3 py-2.5 odd:border-r [&:nth-child(-n+2)]:border-b"
          >
            <dt className="order-2 text-[12px] leading-tight text-tinta-suave">{etiqueta}</dt>
            <dd className="numeros order-1 text-[15px] font-semibold">{valor}</dd>
          </div>
        ))}
      </dl>
    </header>
  );
}
