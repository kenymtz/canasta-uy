import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Compra } from "../lib/compras";

// Una "nube" de mentira que se comporta como la tabla de Supabase: guarda por ticket y no repite
const enLaNube = new Map<string, Compra>();
vi.mock("../lib/nube", () => ({
  nube: {
    traerCompras: vi.fn(async () => [...enLaNube.values()]),
    subirCompras: vi.fn(async (compras: Compra[]) => {
      for (const c of compras) if (!enLaNube.has(c.id)) enLaNube.set(c.id, c);
    }),
    borrarCompra: vi.fn(async (id: string) => {
      enLaNube.delete(id);
    }),
  },
}));

const { useCompras } = await import("./compras");
const { nube } = await import("../lib/nube");

function compra(id: string, fecha = "2026-09-30"): Compra {
  return { id, fecha, total: 100, ruc: null, comercio: null, productos: [], guardada: `${fecha}T12:00:00Z` };
}

const ana = { id: "ana", email: "ana@ejemplo.com", nombre: "Ana" };
const ids = () => useCompras.getState().compras.map((c) => c.id).sort();

describe("useCompras con cuenta", () => {
  beforeEach(() => {
    enLaNube.clear();
    vi.clearAllMocks();
    useCompras.setState({ compras: [], usuario: null, sincronizando: false, errorNube: null });
  });

  it("sin sesión guarda solo en el teléfono", () => {
    useCompras.getState().guardar(compra("t1"));
    expect(ids()).toEqual(["t1"]);
    expect(nube.subirCompras).not.toHaveBeenCalled();
  });

  it("al entrar sube lo del teléfono y trae lo de la cuenta", async () => {
    enLaNube.set("c1", compra("c1", "2026-08-01"));
    useCompras.getState().guardar(compra("t1"));
    await useCompras.getState().entrar(ana);
    expect(ids()).toEqual(["c1", "t1"]);
    expect([...enLaNube.keys()].sort()).toEqual(["c1", "t1"]);
    expect(useCompras.getState().sincronizando).toBe(false);
  });

  it("con sesión, guardar y borrar también cambian la cuenta", async () => {
    await useCompras.getState().entrar(ana);
    useCompras.getState().guardar(compra("n1"));
    await vi.waitFor(() => expect(enLaNube.has("n1")).toBe(true));
    useCompras.getState().borrar("n1");
    await vi.waitFor(() => expect(enLaNube.has("n1")).toBe(false));
  });

  it("al salir, el historial se quita del teléfono pero queda en la cuenta", async () => {
    useCompras.getState().guardar(compra("t1"));
    await useCompras.getState().entrar(ana);
    useCompras.getState().salir();
    expect(ids()).toEqual([]);
    expect(useCompras.getState().usuario).toBeNull();
    expect(enLaNube.has("t1")).toBe(true);
  });

  it("si la nube falla al entrar, avisa y no pierde lo del teléfono", async () => {
    vi.mocked(nube.traerCompras).mockRejectedValueOnce(new Error("No pudimos traer tus compras de la cuenta."));
    useCompras.getState().guardar(compra("t1"));
    await useCompras.getState().entrar(ana);
    expect(ids()).toEqual(["t1"]);
    expect(useCompras.getState().errorNube).toBe("No pudimos traer tus compras de la cuenta.");
  });
});
