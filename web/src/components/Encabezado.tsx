import { Info, Receipt } from "@phosphor-icons/react";

interface Props {
  /** Fecha del último precio (AAAA-MM-DD), o null mientras carga */
  ultimoPrecio: string | null;
}

function fechaLegible(iso: string): string {
  const [anio, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${anio}`;
}

export function Encabezado({ ultimoPrecio }: Props) {
  return (
    <header className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-acento">
        <Receipt size={22} weight="bold" aria-hidden />
        <span className="text-[15px] font-semibold tracking-tight text-tinta">Canasta UY</span>
      </div>
      <h1 className="text-[28px] leading-[1.1] font-semibold tracking-tight text-balance sm:text-[32px]">
        ¿Dónde te sale más barata la compra?
      </h1>
      <p className="flex items-center gap-1.5 text-sm text-tinta-suave">
        <Info size={16} aria-hidden />
        {ultimoPrecio
          ? `Precios oficiales del SIPC al ${fechaLegible(ultimoPrecio)}`
          : "Precios oficiales del SIPC"}
      </p>
    </header>
  );
}
