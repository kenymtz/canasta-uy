import { beforeEach, describe, expect, it } from "vitest";

import type { Generico } from "../lib/api";
import { useCanasta } from "./canasta";

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
    expect(useCanasta.getState().items[3]).toBe(0.9);
    sumar(aceite);
    expect(useCanasta.getState().items[3]).toBeCloseTo(1.4);
  });

  it("restar hasta cero saca el producto de la canasta", () => {
    const { sumar, restar } = useCanasta.getState();
    sumar(huevos);
    sumar(huevos);
    expect(useCanasta.getState().items[10]).toBe(12);
    restar(huevos);
    restar(huevos);
    expect(useCanasta.getState().items).not.toHaveProperty("10");
  });

  it("guardar una lista y cargarla después con un toque", () => {
    const { sumar, guardarLista, vaciar, cargarLista } = useCanasta.getState();
    sumar(huevos);
    sumar(aceite);
    guardarLista("Compra del mes");
    vaciar();
    expect(useCanasta.getState().items).toEqual({});
    cargarLista("Compra del mes");
    expect(useCanasta.getState().items).toEqual({ 10: 6, 3: 0.9 });
  });

  it("guardar con un nombre que ya existe actualiza esa lista", () => {
    const { sumar, guardarLista } = useCanasta.getState();
    sumar(huevos);
    guardarLista("Compra del mes");
    sumar(huevos);
    guardarLista("  Compra del mes ");
    const { listas } = useCanasta.getState();
    expect(listas).toHaveLength(1);
    expect(listas[0].items).toEqual({ 10: 12 });
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
