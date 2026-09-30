import { describe, expect, it } from "vitest";

import { formatoCantidad, formatoPlata, nombreProducto, partesCantidad } from "./formato";

describe("formatoPlata", () => {
  it("usa punto de miles y coma decimal, como en Uruguay", () => {
    expect(formatoPlata(1480.5)).toBe("$ 1.480,50");
  });

  it("no muestra decimales si el monto es entero, y el signo no se separa del número", () => {
    expect(formatoPlata(79)).toBe("$ 79");
    expect(formatoPlata(1518)).toBe("$ 1.518");
  });
});

describe("formatoCantidad", () => {
  it("muestra gramos debajo del kilo", () => {
    expect(formatoCantidad(0.5, "kg")).toBe("500 g");
    expect(formatoCantidad(0.09, "kg")).toBe("90 g");
  });

  it("muestra kilos con coma decimal", () => {
    expect(formatoCantidad(1.5, "kg")).toBe("1,5 kg");
    expect(formatoCantidad(2, "kg")).toBe("2 kg");
  });

  it("muestra mililitros debajo del litro", () => {
    expect(formatoCantidad(0.9, "l")).toBe("900 ml");
    expect(formatoCantidad(1.25, "l")).toBe("1,25 l");
  });

  it("unidades y metros", () => {
    expect(formatoCantidad(12, "unidad")).toBe("12 u");
    expect(formatoCantidad(120, "m")).toBe("120 m");
  });
});

describe("nombreProducto", () => {
  it("saca la cantidad que el SIPC agrega al final de algunos nombres", () => {
    expect(nombreProducto("Papa Blanca,  1.0 kilogramos")).toBe("Papa Blanca");
    expect(nombreProducto("Crema Facial Revitalift Filler Dia, 50.0 mililitros")).toBe("Crema Facial Revitalift Filler Dia");
  });

  it("deja igual los nombres sin ese agregado", () => {
    expect(nombreProducto("Arroz blanco Aruba tipo Patna Bolsa 1 kg.")).toBe("Arroz blanco Aruba tipo Patna Bolsa 1 kg.");
  });
});

describe("partesCantidad", () => {
  it("separa número y unidad, pasando a gramos o mililitros debajo de 1", () => {
    expect(partesCantidad(0.5, "kg")).toEqual({ valor: 500, sufijo: "g" });
    expect(partesCantidad(1.5, "kg")).toEqual({ valor: 1.5, sufijo: "kg" });
    expect(partesCantidad(0.9, "l")).toEqual({ valor: 900, sufijo: "ml" });
    expect(partesCantidad(12, "unidad")).toEqual({ valor: 12, sufijo: "u" });
  });
});
