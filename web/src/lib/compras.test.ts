import { describe, expect, it } from "vitest";

import {
  anterior,
  cambiosDePrecio,
  combinar,
  type Compra,
  comercioSugerido,
  diferencia,
  faltanEnLaCuenta,
  idCompra,
  ordenar,
} from "./compras";
import type { CompraQr } from "./qrDgi";

const tata = { establecimiento_id: 7, nombre: "Ta - Ta - Hiper Salto", direccion: "19 de Abril y Soca", ciudad: "Salto" };

function compra(id: string, fecha: string, total: number, extra: Partial<Compra> = {}): Compra {
  return { id, fecha, total, ruc: null, comercio: null, productos: [], guardada: `${fecha}T12:00:00Z`, ...extra };
}

const qr: CompraQr = { ruc: "214844360018", tipo: "e-Ticket", serie: "A", numero: "1234567", monto: 1480.5, fecha: "2026-09-30" };

describe("idCompra", () => {
  it("con QR usa el número del comprobante: el mismo ticket da el mismo id", () => {
    expect(idCompra(qr)).toBe("cfe-214844360018-e-Ticket-A-1234567");
    expect(idCompra({ ...qr })).toBe(idCompra(qr));
  });

  it("sin QR genera uno distinto cada vez", () => {
    expect(idCompra(null)).not.toBe(idCompra(null));
  });
});

describe("ordenar y anterior", () => {
  const compras = [compra("b", "2026-09-10", 900), compra("c", "2026-09-30", 1100), compra("a", "2026-08-30", 1000)];

  it("ordena de la más nueva a la más vieja", () => {
    expect(ordenar(compras).map((c) => c.id)).toEqual(["c", "b", "a"]);
  });

  it("la anterior es la inmediatamente previa por fecha", () => {
    expect(anterior(compras, compras[1])?.id).toBe("b");
    expect(anterior(compras, compras[2])).toBeUndefined();
  });

  it("si dos compras son del mismo día, decide cuándo se guardó cada una", () => {
    const tarde = compra("tarde", "2026-09-30", 50, { guardada: "2026-09-30T20:00:00Z" });
    expect(anterior([...compras, tarde], tarde)?.id).toBe("c");
  });
});

describe("diferencia", () => {
  it("dice cuánto más se gastó y en qué porcentaje", () => {
    expect(diferencia(compra("n", "2026-09-30", 1100), compra("v", "2026-09-01", 1000))).toEqual({ monto: 100, cambio: 0.1 });
  });

  it("si se gastó menos, la diferencia es negativa", () => {
    expect(diferencia(compra("n", "2026-09-30", 900.1), compra("v", "2026-09-01", 1000)).monto).toBe(-99.9);
  });
});

describe("cambiosDePrecio", () => {
  const vieja = compra("v", "2026-09-01", 300, {
    productos: [
      { descripcion: "ACEITE OPTIMO 900CC", precio: 100 },
      { descripcion: "ARROZ SAMAN 1KG", precio: 50 },
    ],
  });
  const nueva = compra("n", "2026-09-30", 300, {
    productos: [
      { descripcion: "Aceite  Óptimo 900cc", precio: 108 }, // el lector metió un espacio y una tilde
      { descripcion: "ARROZ SAMAN 1KG", precio: 50 }, // mismo precio: no es un cambio
      { descripcion: "YERBA CANARIA 1KG", precio: 250 }, // primera vez que la compra
    ],
  });

  it("compara cada producto con la última vez que lo compró", () => {
    expect(cambiosDePrecio([vieja, nueva], nueva)).toEqual([
      { descripcion: "Aceite  Óptimo 900cc", antes: 100, ahora: 108, cambio: 0.08 },
    ]);
  });

  it("no compara con compras posteriores", () => {
    expect(cambiosDePrecio([vieja, nueva], vieja)).toEqual([]);
  });
});

describe("comercioSugerido", () => {
  it("propone el comercio elegido la última vez para esa empresa", () => {
    const compras = [compra("a", "2026-09-01", 10, { ruc: qr.ruc, comercio: tata }), compra("b", "2026-09-02", 10, { ruc: "otro" })];
    expect(comercioSugerido(compras, qr.ruc)).toEqual(tata);
    expect(comercioSugerido(compras, "nuevo")).toBeNull();
    expect(comercioSugerido(compras, null)).toBeNull();
  });
});

describe("combinar y faltanEnLaCuenta", () => {
  const soloTelefono = compra("t", "2026-09-01", 100);
  const enLosDos = compra("d", "2026-09-02", 200);
  const enLosDosDeLaCuenta = { ...enLosDos, comercio: tata };
  const soloCuenta = compra("c", "2026-09-03", 300);

  it("junta las dos listas sin repetir tickets y, si está en las dos, vale la de la cuenta", () => {
    const juntas = combinar([soloTelefono, enLosDos], [enLosDosDeLaCuenta, soloCuenta]);
    expect(juntas.map((c) => c.id).sort()).toEqual(["c", "d", "t"]);
    expect(juntas.find((c) => c.id === "d")?.comercio).toEqual(tata);
  });

  it("sube solo las que no estaban en la cuenta", () => {
    expect(faltanEnLaCuenta([soloTelefono, enLosDos], [enLosDosDeLaCuenta, soloCuenta])).toEqual([soloTelefono]);
  });
});
