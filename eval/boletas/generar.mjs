// Genera boletas falsas, parecidas a fotos reales, con la respuesta correcta al lado.
//
//   node generar.mjs [cantidad] [semilla]
//
// Cada boleta: generadas/NNN.jpg + generadas/NNN.json con
//   { formato, degradacion, productos: [{descripcion, precio}], sensibles: [...], recorte }
// Los productos salen del catálogo real del SIPC (web/public/datos/precios.json); los datos
// personales y de pago son inventados y sirven para comprobar que nunca se cuelan.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const CANTIDAD = Number(process.argv[2] ?? 48);
let semilla = Number(process.argv[3] ?? 7);
const CATALOGO = process.env.CATALOGO ?? "/datos/precios.json";
const SALIDA = "generadas";

// ─── Números al azar repetibles ──────────────────────────────────────────────
function azar() {
  semilla = (semilla * 1103515245 + 12345) % 2 ** 31;
  return semilla / 2 ** 31;
}
const entre = (a, b) => a + azar() * (b - a);
const entero = (a, b) => Math.floor(entre(a, b + 1));
const elegir = (lista) => lista[Math.floor(azar() * lista.length)];

// ─── Nombres de producto al estilo ticket ────────────────────────────────────
// "Aceite de girasol Óptimo Envase 900 cc" → "ACEITE GIRASOL OPTIMO 900CC"
const nombres = JSON.parse(readFileSync(CATALOGO, "utf-8")).productos.map(([, nombre]) => nombre);
function aTicket(nombre) {
  return nombre
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/,\s+[\d.]+\s+\p{L}+\s*$/u, "") // ", 1.0 kilogramos" del SIPC
    .replace(/\b(de|del|la|el|en|con|Envase|Paquete|Bolsa|Botella|Caja|Lata|Frasco|Sachet)\b/gi, "")
    .replace(/(\d+)\s*(cc|ml|grs?|kg|lts?|l|g)\.?/gi, "$1$2")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, entero(26, 36))
    .trim();
}

const plata = (n) => n.toFixed(2).replace(".", ",");
const miles = (n) => plata(n).replace(/\B(?=(\d{3})+,)/g, ".");

// ─── Datos inventados que nunca deberían salir ───────────────────────────────
const NOMBRES_FALSOS = ["JUAN PEREZ", "MARIA GOMEZ", "ANA RODRIGUEZ", "PEDRO SILVA", "LUCIA FERNANDEZ"];
function sensibles() {
  const tarjeta = String(entero(1000, 9999));
  const cedula = `${entero(1, 6)}.${entero(100, 999)}.${entero(100, 999)}-${entero(0, 9)}`;
  const nombre = elegir(NOMBRES_FALSOS);
  const autorizacion = String(entero(100000, 999999));
  return {
    valores: [tarjeta, cedula, ...nombre.split(" "), autorizacion],
    lineas: [
      `${elegir(["VISA", "MASTER", "OCA", "CABAL"])} ${elegir(["DEBITO", "CREDITO"])} ****${tarjeta}`,
      `AUTORIZACION ${autorizacion}`,
      `CLIENTE: ${nombre}`,
      `C.I. ${cedula}`,
    ],
  };
}

// ─── Formatos de ticket ──────────────────────────────────────────────────────
// Cada uno devuelve el HTML del cuerpo y los productos tal como deberían leerse.
const FORMATOS = {
  // Descripción y monto en la misma línea
  simple(productos) {
    return {
      cabecera: "Producto                     Importe",
      lineas: productos.map((p) => `${p.descripcion.padEnd(30)} ${miles(p.precio).padStart(9)}`),
    };
  },
  // Como Macromercado: código, descripción, cantidad, precio unitario y monto con letra de IVA
  columnas(productos) {
    return {
      cabecera: "Producto                     Cant   Precio   Monto IVA",
      lineas: productos.map((p) => {
        const cantidad = p.porPeso ? entre(0.3, 2.5) : entero(1, 3);
        const unitario = Math.round((p.precio / cantidad) * 100) / 100;
        p.precio = Math.round(cantidad * unitario * 100) / 100;
        return `${entero(10000, 99999)} ${p.descripcion.padEnd(30)} ${cantidad.toFixed(3).replace(".", ",")} ${plata(unitario).padStart(7)} ${plata(p.precio).padStart(8)}${elegir(["M", "B"])}`;
      }),
    };
  },
  // Descripción en una línea y "cantidad x unitario  monto" en la siguiente
  dosLineas(productos) {
    return {
      cabecera: "Descripcion                  Importe",
      lineas: productos.flatMap((p) => {
        const cantidad = entero(1, 3);
        if (cantidad === 1) return [`${p.descripcion.padEnd(30)} ${plata(p.precio).padStart(9)}`];
        const unitario = Math.round((p.precio / cantidad) * 100) / 100;
        p.precio = Math.round(cantidad * unitario * 100) / 100;
        return [p.descripcion, `   ${cantidad} x ${plata(unitario)}`.padEnd(31) + plata(p.precio).padStart(9)];
      }),
    };
  },
};

function boletaHtml(formato, productos, datos) {
  const { cabecera, lineas } = FORMATOS[formato](productos);
  const total = productos.reduce((t, p) => t + p.precio, 0);
  const escapar = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const bloque = (ls) => ls.map(escapar).join("\n");
  return `<!doctype html><meta charset="utf-8"><body style="margin:0;background:transparent">
<div id="ticket" style="display:inline-block;background:#f7f6f1;padding:28px 22px 40px;color:#1d1d1d;
  font:${entero(15, 18)}px/1.45 'DejaVu Sans Mono','Liberation Mono',monospace;letter-spacing:${entre(-0.3, 0.2).toFixed(2)}px">
<pre style="margin:0;font:inherit;text-align:center;font-weight:bold;font-size:1.3em">SUPERMERCADO EJEMPLO S.A.</pre>
<pre style="margin:0;font:inherit">${bloque([
    `RUT 21${entero(1000000000, 9999999999)}`,
    "Av. Siempre Viva 742 - Montevideo",
    `e-Ticket A ${entero(1000000, 9999999)}  Contado`,
    `Fecha: ${String(entero(1, 28)).padStart(2, "0")}/09/2026  ${entero(8, 21)}:${String(entero(0, 59)).padStart(2, "0")}`,
    "-".repeat(44),
  ])}</pre>
<pre id="productos" style="margin:0;font:inherit">${bloque([cabecera, ...lineas])}</pre>
<pre style="margin:0;font:inherit">${bloque([
    "-".repeat(44),
    `Redondeo${"-0,16".padStart(36)}`,
    `T.M.Imp.:${plata(total * 0.4).padStart(35)}`,
    `T.B.Imp.:${plata(total * 0.5).padStart(35)}`,
    `IVA T.B.:${plata(total * 0.1).padStart(35)}`,
    `TOTAL${miles(total).padStart(39)}`,
    "",
    ...datos.lineas,
    "Gracias por su compra",
  ])}</pre></div></body>`;
}

// ─── Cómo se "ensucia" cada nivel ────────────────────────────────────────────
const DEGRADACIONES = {
  limpia: { giro: 0, arrugas: 0, sombra: 0, desenfoque: 0, ruido: 0, ancho: 1400, calidad: 0.95 },
  leve: { giro: 1.5, arrugas: 1, sombra: 0.15, desenfoque: 0.4, ruido: 8, ancho: 1200, calidad: 0.85 },
  media: { giro: 3, arrugas: 2.5, sombra: 0.3, desenfoque: 0.8, ruido: 14, ancho: 1000, calidad: 0.72 },
  fuerte: { giro: 5, arrugas: 4.5, sombra: 0.45, desenfoque: 1.2, ruido: 22, ancho: 850, calidad: 0.6 },
  // Como llega por WhatsApp la foto de un ticket largo: tan achicada que entre renglón y
  // renglón quedan unos 20 px (como en la boleta real de Macromercado) y JPG comprimido
  whatsapp: { giro: 2, arrugas: 1.5, sombra: 0.2, desenfoque: 0.3, ruido: 8, renglon: [19, 24], calidad: 0.7 },
};

/** En el navegador: pone el ticket sobre un fondo, lo gira, lo arruga y lo saca como una foto JPG. */
async function fotografiar(pagina, png, d, cajaProductos, renglonOriginal) {
  return pagina.evaluate(
    async ({ png, d, caja, fondo, giro, fase, renglonOriginal }) => {
      const img = new Image();
      img.src = "data:image/png;base64," + png;
      await img.decode();
      const margen = 0.18;
      const W = Math.round(img.width * (1 + margen * 2));
      const H = Math.round(img.height * (1 + margen));
      const lienzo = document.createElement("canvas");
      lienzo.width = W;
      lienzo.height = H;
      const ctx = lienzo.getContext("2d");
      ctx.fillStyle = fondo; // la mesa
      ctx.fillRect(0, 0, W, H);

      // Ticket arrugado: se dibuja en franjas horizontales corridas por una onda
      const ticket = document.createElement("canvas");
      ticket.width = img.width;
      ticket.height = img.height;
      const t = ticket.getContext("2d");
      const franja = 6;
      for (let y = 0; y < img.height; y += franja) {
        const dx = d.arrugas * Math.sin(y / 37 + fase) * 2 + d.arrugas * Math.sin(y / 11 + fase * 2);
        t.drawImage(img, 0, y, img.width, franja, dx, y, img.width, franja);
        // Pliegues: algunas franjas más oscuras o más claras
        const luz = d.arrugas * 0.02 * Math.sin(y / 23 + fase);
        t.fillStyle = luz > 0 ? `rgba(255,255,255,${luz})` : `rgba(0,0,0,${-luz})`;
        t.fillRect(0, y, img.width, franja);
      }

      const cx = W / 2;
      const cy = H / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((giro * Math.PI) / 180);
      ctx.filter = d.desenfoque ? `blur(${d.desenfoque}px)` : "none";
      ctx.drawImage(ticket, -img.width / 2, -img.height / 2);
      ctx.restore();

      // Sombra de la mano o del celular sobre una parte del ticket
      if (d.sombra) {
        const g = ctx.createLinearGradient(0, H * 0.3, W, H * 0.7);
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(0.5, `rgba(0,0,0,${d.sombra})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      // Ruido del sensor
      if (d.ruido) {
        const datos = ctx.getImageData(0, 0, W, H);
        for (let i = 0; i < datos.data.length; i += 4) {
          const n = (Math.random() - 0.5) * d.ruido;
          datos.data[i] += n;
          datos.data[i + 1] += n;
          datos.data[i + 2] += n;
        }
        ctx.putImageData(datos, 0, 0);
      }

      // Resolución de la foto (achicar) y compresión JPG
      const escala = d.renglon ? Math.min(1, d.renglon / renglonOriginal) : Math.min(1, d.ancho / W);
      const foto = document.createElement("canvas");
      foto.width = Math.round(W * escala);
      foto.height = Math.round(H * escala);
      foto.getContext("2d").drawImage(lienzo, 0, 0, foto.width, foto.height);

      // Dónde quedó la zona de productos después de girar (rectángulo que la contiene, con margen)
      const rad = (giro * Math.PI) / 180;
      const esquinas = [
        [caja.x, caja.y],
        [caja.x + caja.ancho, caja.y],
        [caja.x, caja.y + caja.alto],
        [caja.x + caja.ancho, caja.y + caja.alto],
      ].map(([x, y]) => {
        const px = x - img.width / 2;
        const py = y - img.height / 2;
        return [cx + px * Math.cos(rad) - py * Math.sin(rad), cy + px * Math.sin(rad) + py * Math.cos(rad)];
      });
      const xs = esquinas.map((e) => e[0]);
      const ys = esquinas.map((e) => e[1]);
      const holgura = 14;
      const recorte = {
        x: Math.max(0, (Math.min(...xs) - holgura) * escala),
        y: Math.max(0, (Math.min(...ys) - holgura) * escala),
        ancho: (Math.max(...xs) - Math.min(...xs) + holgura * 2) * escala,
        alto: (Math.max(...ys) - Math.min(...ys) + holgura * 2) * escala,
      };
      recorte.ancho = Math.min(recorte.ancho, foto.width - recorte.x);
      recorte.alto = Math.min(recorte.alto, foto.height - recorte.y);
      return { jpg: foto.toDataURL("image/jpeg", d.calidad).split(",")[1], recorte };
    },
    {
      png,
      d,
      caja: cajaProductos,
      fondo: elegir(["#5b1f22", "#2a2f45", "#6b5a45", "#3c4a3a", "#9a9a95"]),
      giro: d.giro ? entre(-d.giro, d.giro) : 0,
      fase: entre(0, 6.28),
      renglonOriginal,
    },
  );
}

// ─── Armar el lote ───────────────────────────────────────────────────────────
rmSync(SALIDA, { recursive: true, force: true });
mkdirSync(SALIDA, { recursive: true });
const nav = await chromium.launch();
const pagina = await nav.newPage({ deviceScaleFactor: 2 });
const formatos = Object.keys(FORMATOS);
const niveles = Object.keys(DEGRADACIONES);

for (let i = 0; i < CANTIDAD; i++) {
  // Se reparten parejo: cada formato con cada nivel
  const formato = formatos[i % formatos.length];
  const degradacion = niveles[Math.floor(i / formatos.length) % niveles.length];
  const productos = Array.from({ length: entero(3, 9) }, () => {
    const porPeso = azar() < 0.2;
    return { descripcion: aTicket(elegir(nombres)), precio: Math.round(entre(25, 480) * 100) / 100, porPeso };
  });
  const datos = sensibles();
  await pagina.setContent(boletaHtml(formato, productos, datos));
  const ticket = pagina.locator("#ticket");
  const caja = await pagina.evaluate(() => {
    const t = document.getElementById("ticket").getBoundingClientRect();
    const p = document.getElementById("productos").getBoundingClientRect();
    return { x: p.left - t.left, y: p.top - t.top, ancho: p.width, alto: p.height };
  });
  const png = (await ticket.screenshot({ omitBackground: true })).toString("base64");
  // La captura sale al doble (deviceScaleFactor 2): la caja también
  const cajaPx = { x: caja.x * 2, y: caja.y * 2, ancho: caja.ancho * 2, alto: caja.alto * 2 };
  // Alto de un renglón en la captura (al doble por deviceScaleFactor 2)
  const renglonOriginal = await pagina.evaluate(() => parseFloat(getComputedStyle(document.getElementById("productos")).lineHeight) * 2);
  const nivel = { ...DEGRADACIONES[degradacion] };
  if (nivel.renglon) nivel.renglon = entre(...nivel.renglon);
  const { jpg, recorte } = await fotografiar(pagina, png, nivel, cajaPx, renglonOriginal);

  const nombre = String(i + 1).padStart(3, "0");
  writeFileSync(`${SALIDA}/${nombre}.jpg`, Buffer.from(jpg, "base64"));
  writeFileSync(
    `${SALIDA}/${nombre}.json`,
    JSON.stringify(
      {
        formato,
        degradacion,
        productos: productos.map(({ descripcion, precio }) => ({ descripcion, precio })),
        sensibles: datos.valores,
        recorte,
      },
      null,
      2,
    ),
  );
}
await nav.close();
console.log(`${CANTIDAD} boletas en ${SALIDA}/ (${formatos.length} formatos × ${niveles.length} niveles de foto)`);
