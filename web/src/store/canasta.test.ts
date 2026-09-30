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
  beforeEach(() => useCanasta.getState().vaciar());

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

  it("cargarBasica usa los productos que existen e ignora los que no", () => {
    useCanasta.getState().cargarBasica([huevos, aceite]);
    const { items } = useCanasta.getState();
    expect(items[10]).toBe(12);
    expect(items[3]).toBe(0.9);
    expect(Object.keys(items)).toHaveLength(2);
  });

  it("el presupuesto vacío o no positivo queda como null", () => {
    const { setPresupuesto } = useCanasta.getState();
    setPresupuesto(1500);
    expect(useCanasta.getState().presupuesto).toBe(1500);
    setPresupuesto(0);
    expect(useCanasta.getState().presupuesto).toBeNull();
  });
});
