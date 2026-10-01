// Compara la cotización del navegador (cotizar.ts) con la de la base (mart.cotizar_canasta)
// para muchas canastas al azar. Necesita la API andando y los archivos exportados:
//
//   docker compose run --rm pipelines python -m pipelines.exportar.web_estatica
//   docker compose exec -e PARIDAD_API=http://api:8000 web npx vitest run src/lib/paridad.test.ts

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { Ciudad, Generico, PedidoCanasta, ResultadoComercio } from "./api";
import { type ComercioBase, cotizarCanasta, type DatosPrecios, indexarPrecios } from "./cotizar";

const API = process.env.PARIDAD_API;

function leer<T>(archivo: string): T {
  return JSON.parse(readFileSync(new URL(`../../public/datos/${archivo}`, import.meta.url), "utf-8")) as T;
}

// Números al azar pero repetibles: la misma semilla arma siempre las mismas canastas
function azar(semilla: number) {
  return () => ((semilla = (semilla * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
}

describe.skipIf(!API)("paridad con mart.cotizar_canasta", () => {
  it("da los mismos comercios, totales y detalle que la base", async () => {
    const base = leer<{ ciudades: Ciudad[]; genericos: Generico[]; comercios: ComercioBase[] }>("base.json");
    const datos = { ...base, indice: indexarPrecios(leer<DatosPrecios>("precios.json")) };
    const r = azar(42);
    let comparados = 0;

    for (let caso = 0; caso < Number(process.env.PARIDAD_CASOS ?? 60); caso++) {
      const ciudad = base.ciudades[Math.floor(r() * base.ciudades.length)];
      const elegidos = [...base.genericos].sort(() => r() - 0.5).slice(0, 1 + Math.floor(r() * 12));
      const pedido: PedidoCanasta = {
        items: elegidos.map((g) => ({
          producto_canonico_id: g.producto_canonico_id,
          cantidad: Math.max(0.5, Math.round(r() * 8) / 2),
        })),
        lat: ciudad.lat,
        lon: ciudad.lon,
        radio_km: [1, 3, 5, 10, 20][Math.floor(r() * 5)],
        presupuesto: r() < 0.5 ? null : Math.round(r() * 3000),
        limite: 100,
      };

      const respuesta = await fetch(`${API}/canasta/cotizar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pedido),
      });
      const esperado = (await respuesta.json()) as ResultadoComercio[];
      const obtenido = cotizarCanasta(pedido, datos);

      // Si dos comercios empatan, la base no garantiza el orden: se comparan por id
      const porId = (lista: ResultadoComercio[]) => new Map(lista.map((x) => [x.establecimiento_id, x]));
      const esperados = porId(esperado);
      const obtenidos = porId(obtenido);
      const contexto = `${ciudad.ciudad} (${ciudad.departamento}), radio ${pedido.radio_km} km`;

      // Con 100 resultados, el corte puede caer entre comercios empatados y dejar afuera a otros
      if (esperado.length < pedido.limite!) {
        expect([...obtenidos.keys()].sort(), contexto).toEqual([...esperados.keys()].sort());
      }
      expect(obtenido.map((x) => [x.cobertura, x.total]), contexto).toEqual(esperado.map((x) => [x.cobertura, x.total]));
      for (const [id, e] of esperados) {
        if (!obtenidos.has(id)) continue;
        const { distancia_km, ...o } = obtenidos.get(id)!;
        // Al redondear a dos decimales, una diferencia de milímetros puede mover el último
        expect(Math.abs(distancia_km - e.distancia_km), contexto).toBeLessThanOrEqual(0.011);
        expect({ ...o, distancia_km: 0 }, contexto).toEqual({ ...e, distancia_km: 0 });
        comparados++;
      }
    }
    console.log(`  ${comparados} comercios cotizados igual en las dos versiones`);
  }, 60_000);
});
