import { describe, expect, it } from "vitest";

import { leerQrDgi } from "./qrDgi";

const QR = "https://www.efactura.dgi.gub.uy/consultaQR/cfe?214844360018,101,A,1234567,1480.50,30/09/2026,q2bA9x+/Zk=";

describe("leerQrDgi", () => {
  it("lee los datos de un e-Ticket de la DGI", () => {
    expect(leerQrDgi(QR)).toEqual({
      ruc: "214844360018",
      tipo: "e-Ticket",
      serie: "A",
      numero: "1234567",
      monto: 1480.5,
      fecha: "2026-09-30",
    });
  });

  it("acepta el dominio sin www y con http", () => {
    expect(leerQrDgi(QR.replace("https://www.", "http://"))?.ruc).toBe("214844360018");
  });

  it("reconoce e-Facturas", () => {
    expect(leerQrDgi(QR.replace(",101,", ",111,"))?.tipo).toBe("e-Factura");
  });

  it("rechaza QR que no son de la DGI", () => {
    expect(leerQrDgi("https://ejemplo.com/consultaQR/cfe?214844360018,101,A,1,10,30/09/2026,x")).toBeNull();
    expect(leerQrDgi("hola")).toBeNull();
  });

  it("rechaza QR de la DGI incompletos o con datos inválidos", () => {
    expect(leerQrDgi("https://www.efactura.dgi.gub.uy/consultaQR/cfe?214844360018,101,A")).toBeNull();
    expect(leerQrDgi(QR.replace("1480.50", "mil"))).toBeNull();
    expect(leerQrDgi(QR.replace("30/09/2026", "2026-09-30"))).toBeNull();
  });
});
