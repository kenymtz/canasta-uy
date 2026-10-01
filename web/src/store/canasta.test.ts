import { beforeEach, describe, expect, it } from "vitest";

import type { Generico } from "../lib/api";
import { migrar, useCanasta } from "./canasta";

const huevos: Generico = {
  producto_canonico_id: 10,
  nombre: "Huevos",
  categoria: "Lácteos y huevos",
  unidad_base: "unidad",
  se_vende_suelto: false,
  comercios_con_precio: 400,
};

const aceite: Generico = { ...huevos, producto_canonico_id: 3, nombre: "Aceite de girasol", unidad_base: "l" };

describe("useCanasta", () => {
  beforeEach(() => useCanasta.setState({ items: {}, listas: [] }));

  it("sumar agrega el producto con su cantidad inicial y después suma de a un paso", () => {
    const { sumar } = useCanasta.getState();
    sumar(aceite);
    expect(useCanasta.getState().items["Aceite de girasol"]).toBe(0.9);
    sumar(aceite);
    expect(useCanasta.getState().items["Aceite de girasol"]).toBeCloseTo(1.4);
  });

  it("restar hasta cero saca el producto de la canasta", () => {
    const { sumar, restar } = useCanasta.getState();
    sumar(huevos);
    sumar(huevos);
    expect(useCanasta.getState().items.Huevos).toBe(12);
    restar(huevos);
    restar(huevos);
    expect(useCanasta.getState().items).not.toHaveProperty("Huevos");
  });

  it("guardar una lista y cargarla después con un toque", () => {
    const { sumar, guardarLista, vaciar, cargarLista } = useCanasta.getState();
    sumar(huevos);
    sumar(aceite);
    guardarLista("Compra del mes");
    vaciar();
    expect(useCanasta.getState().items).toEqual({});
    cargarLista("Compra del mes");
    expect(useCanasta.getState().items).toEqual({ Huevos: 6, "Aceite de girasol": 0.9 });
  });

  it("guardar con un nombre que ya existe actualiza esa lista", () => {
    const { sumar, guardarLista } = useCanasta.getState();
    sumar(huevos);
    guardarLista("Compra del mes");
    sumar(huevos);
    guardarLista("  Compra del mes ");
    const { listas } = useCanasta.getState();
    expect(listas).toHaveLength(1);
    expect(listas[0].items).toEqual({ Huevos: 12 });
  });

  it("guardar sin nombre o con la canasta vacía no hace nada", () => {
    const { sumar, guardarLista } = useCanasta.getState();
    guardarLista("Vacía");
    sumar(huevos);
    guardarLista("   ");
    expect(useCanasta.getState().listas).toHaveLength(0);
  });

  it("borrar una lista", () => {
    const { sumar, guardarLista, borrarLista } = useCanasta.getState();
    sumar(huevos);
    guardarLista("Asado");
    borrarLista("Asado");
    expect(useCanasta.getState().listas).toHaveLength(0);
  });

  it("el presupuesto vacío o no positivo queda como null", () => {
    const { setPresupuesto } = useCanasta.getState();
    setPresupuesto(1500);
    expect(useCanasta.getState().presupuesto).toBe(1500);
    setPresupuesto(0);
    expect(useCanasta.getState().presupuesto).toBeNull();
  });
});

describe("migrar", () => {
  it("pasa la canasta y las listas guardadas por id (versión 1) a nombres", () => {
    const v1 = {
      items: { 3: 0.9, 999: 2 }, // 999 no existía: se descarta en lugar de adivinar
      listas: [{ nombre: "Asado", items: { 3: 1.8 }, guardada: "2026-09-30T12:00:00Z" }],
      radioKm: 5,
    };
    const migrado = migrar(v1, 1);
    expect(migrado.items).toEqual({ "Aceite de girasol": 0.9 });
    expect(migrado.listas).toEqual([{ nombre: "Asado", items: { "Aceite de girasol": 1.8 }, guardada: "2026-09-30T12:00:00Z" }]);
    expect(migrado.radioKm).toBe(5);
  });

  it("lo guardado antes de las listas (versión 0) queda con listas vacías", () => {
    expect(migrar({ items: { 3: 0.9 } }, 0)).toMatchObject({ items: { "Aceite de girasol": 0.9 }, listas: [] });
  });
});

describe("quitar", () => {
  it("saca de la canasta los productos sin precios y deja el resto", () => {
    useCanasta.setState({ items: { Frutilla: 1, Huevos: 6 } });
    useCanasta.getState().quitar(["Frutilla"]);
    expect(useCanasta.getState().items).toEqual({ Huevos: 6 });
  });
});
