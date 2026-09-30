import { MapPin } from "@phosphor-icons/react";
import { useMemo } from "react";

import type { Ciudad } from "../lib/api";
import type { Ubicacion as UbicacionElegida } from "../store/canasta";

export const PUNTO_EN_EL_MAPA = "Punto en el mapa";

interface Props {
  ciudades: Ciudad[];
  ubicacion: UbicacionElegida | null;
  radioKm: number;
  onElegir: (u: UbicacionElegida) => void;
  onRadio: (km: number) => void;
}

const campo =
  "h-11 w-full rounded-control border border-linea bg-ticket px-3 text-[15px] text-tinta outline-none focus-visible:border-acento";

export function Ubicacion({ ciudades, ubicacion, radioKm, onElegir, onRadio }: Props) {
  const departamentos = useMemo(
    () => [...new Set(ciudades.map((c) => c.departamento))].sort((a, b) => a.localeCompare(b, "es")),
    [ciudades],
  );
  const departamento = ubicacion?.departamento ?? "";
  const ciudadesDelDepto = ciudades
    .filter((c) => c.departamento === departamento)
    .sort((a, b) => a.ciudad.localeCompare(b.ciudad, "es"));

  function elegirDepartamento(depto: string) {
    // Al cambiar de departamento, va a su ciudad con más comercios
    const principal = ciudades
      .filter((c) => c.departamento === depto)
      .sort((a, b) => b.comercios - a.comercios)[0];
    if (principal) onElegir(principal);
  }

  function elegirCiudad(nombre: string) {
    const c = ciudadesDelDepto.find((x) => x.ciudad === nombre);
    if (c) onElegir(c);
  }

  return (
    <section aria-labelledby="titulo-donde" className="flex flex-col gap-4">
      <h2 id="titulo-donde" className="text-lg font-semibold tracking-tight">
        Dónde estás
      </h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="departamento" className="text-sm font-medium text-tinta-suave">
            Departamento
          </label>
          <select
            id="departamento"
            className={campo}
            value={departamento}
            onChange={(e) => elegirDepartamento(e.target.value)}
          >
            <option value="" disabled>
              Elegí uno
            </option>
            {departamentos.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="ciudad" className="text-sm font-medium text-tinta-suave">
            Ciudad
          </label>
          <select
            id="ciudad"
            className={campo}
            value={ubicacion?.ciudad ?? ""}
            disabled={!departamento}
            onChange={(e) => elegirCiudad(e.target.value)}
          >
            <option value="" disabled>
              {departamento ? "Elegí una" : "Primero el departamento"}
            </option>
            {ubicacion?.ciudad === PUNTO_EN_EL_MAPA && <option>{PUNTO_EN_EL_MAPA}</option>}
            {ciudadesDelDepto.map((c) => (
              <option key={c.ciudad} value={c.ciudad}>
                {c.ciudad} ({c.comercios})
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="flex items-center gap-1.5 text-sm text-tinta-suave">
        <MapPin size={16} aria-hidden />
        También podés tocar el mapa donde estés.
      </p>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <label htmlFor="radio" className="text-sm font-medium text-tinta-suave">
            Hasta dónde te movés
          </label>
          <span className="numeros text-sm font-medium">{radioKm} km</span>
        </div>
        <input
          id="radio"
          type="range"
          min={1}
          max={20}
          step={1}
          value={radioKm}
          onChange={(e) => onRadio(Number(e.target.value))}
          className="h-11 w-full accent-[var(--color-acento)]"
        />
      </div>
    </section>
  );
}
