import { describe, expect, it } from "vitest";

import type { Generico } from "./api";
import { cantidadInicial, paso } from "./pasos";

function generico(nombre: string, unidad_base: Generico["unidad_base"], se_vende_suelto = false): Generico {
  return {
    producto_canonico_id: 1,
    nombre,
    categoria: "Almacén",
    unidad_base,
    se_vende_suelto,
    comercios_con_precio: 100,
  };
}

describe("paso", () => {
  it("los huevos van de a media docena", () => {
    expect(paso(generico("Huevos", "unidad"))).toBe(6);
  });

  it("el papel higiénico va de a paquete de 4 rollos de 30 m", () => {
    expect(paso(generico("Papel higiénico", "m"))).toBe(120);
  });

  it("lo suelto y los paquetes por peso o volumen van de a medio", () => {
    expect(paso(generico("Manzana", "kg", true))).toBe(0.5);
    expect(paso(generico("Arroz blanco", "kg"))).toBe(0.5);
    expect(paso(generico("Yogur", "l"))).toBe(0.5);
  });

  it("lo que se cuenta por unidad va de a uno", () => {
    expect(paso(generico("Afeitadora", "unidad"))).toBe(1);
  });
});

describe("cantidadInicial", () => {
  it("el aceite arranca en una botella de 900 ml", () => {
    expect(cantidadInicial(generico("Aceite de girasol", "l"))).toBe(0.9);
  });

  it("el resto arranca en un paso", () => {
    expect(cantidadInicial(generico("Huevos", "unidad"))).toBe(6);
    expect(cantidadInicial(generico("Arroz blanco", "kg"))).toBe(0.5);
  });
});
