import { describe, expect, it } from "vitest";

import type { Generico, PedidoCanasta } from "./api";
import {
  type ComercioBase,
  comerciosCercanos,
  cotizarCanasta,
  type DatosPrecios,
  distanciaKm,
  indexarPrecios,
  redondear,
} from "./cotizar";

// Plaza Independencia (Montevideo) y dos comercios: uno a ~1 km y otro a ~3 km
const CENTRO = { lat: -34.9061, lon: -56.1994 };

const comercios: ComercioBase[] = [
  { establecimiento_id: 1, nombre: "Cerca", cadena: "Uno", direccion: "Calle 1", ciudad: "Montevideo", lat: -34.8971, lon: -56.1994 },
  { establecimiento_id: 2, nombre: "Lejos", cadena: null, direccion: null, ciudad: "Montevideo", lat: -34.8791, lon: -56.1994 },
];

function generico(id: number, nombre: string, unidad_base: Generico["unidad_base"], se_vende_suelto = false): Generico {
  return { producto_canonico_id: id, nombre, categoria: "Almacén", unidad_base, se_vende_suelto, comercios_con_precio: 2 };
}

const genericos = [generico(1, "Arroz blanco", "kg"), generico(2, "Manzana", "kg", true), generico(3, "Yerba", "kg")];

const datos: DatosPrecios = {
  ultimo_precio: "2026-06-30",
  productos: [
    [1, "Arroz 1 kg", 1],
    [1, "Arroz 5 kg", 5],
    [2, "Manzana roja", 1],
    [3, "Yerba 1 kg", 1],
  ],
  precios: [
    [1, 0, 60, 0], // Cerca: arroz de 1 kg a $60
    [1, 1, 250, 3], // Cerca: arroz de 5 kg a $250, de hace 3 días
    [1, 2, 80, 0], // Cerca: manzana a $80 el kilo
    [2, 0, 55, 0], // Lejos: solo arroz de 1 kg a $55
  ],
};

const base = { comercios, genericos, indice: indexarPrecios(datos) };

function pedido(items: [number, number][], extra: Partial<PedidoCanasta> = {}): PedidoCanasta {
  return {
    items: items.map(([producto_canonico_id, cantidad]) => ({ producto_canonico_id, cantidad })),
    ...CENTRO,
    radio_km: 5,
    presupuesto: null,
    ...extra,
  };
}

function enCerca(p: PedidoCanasta) {
  return cotizarCanasta(p, base).find((r) => r.comercio === "Cerca")!;
}

describe("redondear", () => {
  it("redondea la mitad hacia arriba, como Postgres", () => {
    expect(redondear(1.005)).toBe(1.01);
    expect(redondear(0.125)).toBe(0.13);
    expect(redondear(2 / 3)).toBe(0.67);
  });
});

describe("distanciaKm", () => {
  it("un grado de latitud en Uruguay son unos 111 km", () => {
    // Valor de referencia calculado con PostGIS (ST_Distance sobre geography)
    expect(distanciaKm(-34, -56, -35, -56)).toBeCloseTo(110.9, 1);
  });

  it("de un punto a sí mismo es cero", () => {
    expect(distanciaKm(-34.9, -56.2, -34.9, -56.2)).toBe(0);
  });
});

describe("comerciosCercanos", () => {
  it("devuelve los que entran en el radio, del más cercano al más lejano", () => {
    expect(comerciosCercanos(comercios, CENTRO.lat, CENTRO.lon, 5).map((c) => c.nombre)).toEqual(["Cerca", "Lejos"]);
    expect(comerciosCercanos(comercios, CENTRO.lat, CENTRO.lon, 2).map((c) => c.nombre)).toEqual(["Cerca"]);
  });

  it("redondea la distancia a dos decimales", () => {
    expect(comerciosCercanos(comercios, CENTRO.lat, CENTRO.lon, 5)[0].distancia_km).toBe(1);
  });
});

describe("cotizarCanasta", () => {
  it("elige el paquete que sale más barato según la cantidad pedida", () => {
    // 3 kg: tres de 1 kg ($180) le ganan a uno de 5 kg ($250)
    expect(enCerca(pedido([[1, 3]])).detalle[0]).toMatchObject({ producto: "Arroz 1 kg", unidades: 3, costo: 180 });
    // 5 kg: uno de 5 kg ($250) le gana a cinco de 1 kg ($300)
    expect(enCerca(pedido([[1, 5]])).detalle[0]).toMatchObject({ producto: "Arroz 5 kg", unidades: 1, costo: 250 });
  });

  it("los paquetes no se fraccionan y lo suelto se paga por kilo", () => {
    const cerca = enCerca(pedido([[1, 1.5], [2, 1.5]]));
    expect(cerca.detalle).toEqual([
      { generico: "Arroz blanco", producto: "Arroz 1 kg", cantidad: 1.5, unidades: 2, precio: 60, costo: 120 },
      { generico: "Manzana", producto: "Manzana roja", cantidad: 1.5, unidades: 1.5, precio: 80, costo: 120 },
    ]);
    expect(cerca.total).toBe(240);
  });

  it("ordena primero por cobertura y después por total", () => {
    const resultados = cotizarCanasta(pedido([[1, 1], [2, 1]]), base);
    expect(resultados.map((r) => [r.comercio, r.cobertura, r.total])).toEqual([
      ["Cerca", 1, 140],
      ["Lejos", 0.5, 55],
    ]);
    expect(resultados[1].faltantes).toEqual(["Manzana"]);
  });

  it("deja afuera a los comercios sin ningún producto de la canasta", () => {
    expect(cotizarCanasta(pedido([[3, 1]]), base)).toEqual([]);
  });

  it("informa la fecha del precio más viejo que usó", () => {
    expect(enCerca(pedido([[1, 5], [2, 1]])).fecha_precios).toBe("2026-06-27");
  });

  it("compara el total con el presupuesto", () => {
    const cerca = enCerca(pedido([[1, 1], [2, 1]], { presupuesto: 100 }));
    expect(cerca.entra_en_presupuesto).toBe(false);
    expect(cotizarCanasta(pedido([[1, 1]], { presupuesto: 100 }), base)[0].entra_en_presupuesto).toBe(true);
  });

  it("respeta el límite de comercios", () => {
    expect(cotizarCanasta(pedido([[1, 1]], { limite: 1 }), base)).toHaveLength(1);
  });

  it("rechaza productos que no existen", () => {
    expect(() => cotizarCanasta(pedido([[99, 1]]), base)).toThrow("Productos que no existen: [99]");
  });
});
