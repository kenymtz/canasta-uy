import { describe, expect, it } from "vitest";

import { leerBoleta } from "./boleta";

// Texto como el que sale de leer la foto de una boleta, con datos que NO se deben enviar
const BOLETA = `
TATA HIPER SALTO
RUT 210000000012
19 de Abril y Soca
e-Ticket A 1234567
ARROZ AMERICANO 1KG        51,00
ACEITE GIRASOL 900ML       79,00
YERBA CANARIAS 1KG        186,00
7790387000123 LECHE ENTERA   42,50
DESCUENTO SOCIO            -10,00
SUBTOTAL                  348,50
TOTAL                     348,50
TARJETA VISA ****4821     348,50
AUTORIZACION 084213
CLIENTE: JUAN PEREZ
C.I. 4.567.890-1
juan.perez@correo.com
CAJERA: MARIA
`;

describe("leerBoleta", () => {
  const { productos, quitadas } = leerBoleta(BOLETA);

  it("se queda con las líneas de productos y su precio", () => {
    expect(productos).toEqual([
      { descripcion: "ARROZ AMERICANO 1KG", precio: 51 },
      { descripcion: "ACEITE GIRASOL 900ML", precio: 79 },
      { descripcion: "YERBA CANARIAS 1KG", precio: 186 },
      { descripcion: "••• LECHE ENTERA", precio: 42.5 },
    ]);
  });

  it("nunca deja pasar datos de pago ni personales", () => {
    const enviado = JSON.stringify(productos);
    for (const sensible of ["4821", "084213", "JUAN", "PEREZ", "4.567.890", "correo", "MARIA", "210000000012", "7790387000123"]) {
      expect(enviado).not.toContain(sensible);
    }
  });

  it("cuenta las líneas que quitó por tener posibles datos personales", () => {
    expect(quitadas).toBeGreaterThanOrEqual(6);
  });

  it("descarta totales, subtotales y descuentos", () => {
    const textos = productos.map((p) => p.descripcion);
    expect(textos).not.toContain("TOTAL");
    expect(textos).not.toContain("SUBTOTAL");
    expect(textos.some((t) => t.includes("DESCUENTO"))).toBe(false);
  });

  it("entiende precios con punto decimal o con separador de miles", () => {
    expect(leerBoleta("QUESO RALLADO 80G 1.250,00").productos).toEqual([{ descripcion: "QUESO RALLADO 80G", precio: 1250 }]);
    expect(leerBoleta("PAN FLAUTA 45.90").productos).toEqual([{ descripcion: "PAN FLAUTA", precio: 45.9 }]);
  });

  it("entiende el formato con código, cantidad, precio unitario y letra de IVA (Macromercado)", () => {
    const texto = `
Producto                                 Cantidad  Precio  Monto IVA
31410 SAL SEK FINA YODOFLUORADA 500 GRS.    1,000   45,28   45,28M
31407 SAL SEK GRUESA YODOFLUORADA 500 GRS.  1,000   45,28   45,28M
96525 FIAMBRERIA LNETITOS DULCE DE MEMBRILLO 0,794 160,70  127,60B
Redondeo                                                   -0,16M
T.E.Imp.:  0,00
T.M.Imp.:  82,17
T.B.Imp.: 104,59
IVA T.M.:   8,23
IVA T.B.:  23,01
TOTAL DE COMPRAS  218,00
`;
    expect(leerBoleta(texto).productos).toEqual([
      { descripcion: "SAL SEK FINA YODOFLUORADA 500 GRS.", precio: 45.28 },
      { descripcion: "SAL SEK GRUESA YODOFLUORADA 500 GRS.", precio: 45.28 },
      { descripcion: "FIAMBRERIA LNETITOS DULCE DE MEMBRILLO", precio: 127.6 },
    ]);
  });

  it("descarta el ruido del lector: líneas con muy pocas letras", () => {
    expect(leerBoleta("TM. 82,17\na 1,00\nPAN 45,90").productos).toEqual([{ descripcion: "PAN", precio: 45.9 }]);
  });
});

describe("leerBoleta con lo que agrega el lector de la foto", () => {
  it("acepta un espacio después de la coma y un signo al final del monto", () => {
    expect(leerBoleta("35483 JABON BARRA BULL DOG 1,000 407,32   407, 32B\nFRANKFURTERS OTTONELLO  250,42?").productos).toEqual([
      { descripcion: "JABON BARRA BULL DOG", precio: 407.32 },
      { descripcion: "FRANKFURTERS OTTONELLO", precio: 250.42 },
    ]);
  });

  it("junta los productos en dos renglones: nombre arriba, cantidad por precio abajo", () => {
    const texto = `Descripcion                  Importe
QUESO RALLADO ARTESANO 80GRS

2 x 176,55                     353,10
AFEITADORA XTREME3 PIEL DELICAD    454,52
PALETA VACUNA SIN MARCA 1KG
2 x 101,13                     202,26`;
    expect(leerBoleta(texto).productos).toEqual([
      { descripcion: "QUESO RALLADO ARTESANO 80GRS", precio: 353.1 },
      { descripcion: "AFEITADORA XTREME3 PIEL DELICAD", precio: 454.52 },
      { descripcion: "PALETA VACUNA SIN MARCA 1KG", precio: 202.26 },
    ]);
  });

  it("ante la duda gana la privacidad: \"XxX 176\" parece una tarjeta tapada y se borra", () => {
    const lectura = leerBoleta("QUESO RALLADO 80GRS\n2 XxX 176,55   353,10");
    expect(lectura.productos).toEqual([]);
    expect(lectura.quitadas).toBe(1);
  });

  it("un renglón sensible nunca se usa como nombre del producto de abajo", () => {
    expect(leerBoleta("CLIENTE: JUAN PEREZ\n2 x 10,00   20,00").productos).toEqual([]);
  });

  it("descarta el recuadro de impuestos aunque el lector lo lea mal", () => {
    expect(leerBoleta("T.B.IM” 522,11").productos).toEqual([]);
  });
});
