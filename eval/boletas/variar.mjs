// A partir de cada foto real (reales/), arma muchas versiones "parecidas", con la misma hoja
// de respuestas: más giradas, más oscuras, más borrosas, más chicas, con sombra y con ruido.
// Sirve para probar el lector con boletas reales sin tener que sacar cien fotos.
//
//   node variar.mjs [versiones por foto] [semilla]
//
// Salida: variantes/<foto>-NN.jpg + .json. Como las fotos reales, no se suben a GitHub.

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const VERSIONES = Number(process.argv[2] ?? 12);
let semilla = Number(process.argv[3] ?? 11);
const azar = () => ((semilla = (semilla * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const entre = (a, b) => a + azar() * (b - a);

// Cuánto se puede alejar cada versión de la original, según el nivel
const NIVELES = {
  // Como queda al mandarla por WhatsApp: lado mayor de 1600 px y JPG comprimido, sin más daño
  whatsapp: { giro: 0, escala: "whatsapp", luz: [1, 1], desenfoque: 0, ruido: 3, sombra: 0, calidad: 0.7 },
  // Una captura de la foto en la galería del celular, mandada por WhatsApp: la foto ocupa el
  // ancho de la pantalla (1080 px) y la captura (2400 px de alto) se achica a 1600 px.
  // Queda más chica y comprimida dos veces
  captura: { giro: 0, escala: "captura", luz: [0.97, 1.03], desenfoque: 0.3, ruido: 4, sombra: 0, calidad: 0.65 },
  leve: { giro: 1.5, escala: [0.9, 1.3], luz: [0.9, 1.1], desenfoque: 0.4, ruido: 6, sombra: 0.1, calidad: 0.85 },
  media: { giro: 3, escala: [0.75, 1.1], luz: [0.75, 1.15], desenfoque: 0.8, ruido: 12, sombra: 0.25, calidad: 0.72 },
  fuerte: { giro: 5, escala: [0.6, 0.9], luz: [0.6, 1.2], desenfoque: 1.3, ruido: 20, sombra: 0.4, calidad: 0.6 },
};

if (!existsSync("reales")) {
  console.log("No hay fotos en reales/ (ver README)");
  process.exit(0);
}
rmSync("variantes", { recursive: true, force: true });
mkdirSync("variantes", { recursive: true });

const nav = await chromium.launch();
const pagina = await nav.newPage();
const fotos = readdirSync("reales").filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
let total = 0;

for (const foto of fotos) {
  const base = foto.replace(/\.(jpe?g|png|webp)$/i, "");
  const tipo = foto.endsWith(".png") ? "image/png" : foto.endsWith(".webp") ? "image/webp" : "image/jpeg";
  if (!existsSync(`reales/${base}.json`)) continue;
  const respuesta = JSON.parse(readFileSync(`reales/${base}.json`, "utf-8"));
  const datos = readFileSync(`reales/${foto}`).toString("base64");
  const niveles = Object.keys(NIVELES);

  for (let v = 0; v < VERSIONES; v++) {
    const nivel = niveles[v % niveles.length];
    const n = NIVELES[nivel];
    const ajustes = {
      giro: entre(-n.giro, n.giro),
      escala: Array.isArray(n.escala) ? entre(...n.escala) : n.escala,
      luz: entre(...n.luz),
      desenfoque: entre(0, n.desenfoque),
      ruido: n.ruido,
      sombra: entre(0, n.sombra),
      calidad: n.calidad,
      fase: entre(0, 6.28),
    };
    const { jpg, recorte } = await pagina.evaluate(
      async ({ datos, tipo, a, r }) => {
        const img = new Image();
        img.src = `data:${tipo};base64,${datos}`;
        await img.decode();
        const ladoMayor = Math.max(img.naturalWidth, img.naturalHeight);
        if (a.escala === "whatsapp") a.escala = Math.min(1, 1600 / ladoMayor);
        // Captura: la foto ocupa 1080 px de ancho en pantalla y después todo se achica 1600/2400
        if (a.escala === "captura") a.escala = (1080 / img.naturalWidth) * (1600 / 2400);
        const W = Math.round(img.naturalWidth * a.escala);
        const H = Math.round(img.naturalHeight * a.escala);
        const c = document.createElement("canvas");
        c.width = W;
        c.height = H;
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#3a2a2a";
        ctx.fillRect(0, 0, W, H);
        ctx.save();
        ctx.translate(W / 2, H / 2);
        ctx.rotate((a.giro * Math.PI) / 180);
        ctx.filter = `brightness(${a.luz}) blur(${a.desenfoque}px)`;
        ctx.drawImage(img, -W / 2, -H / 2, W, H);
        ctx.restore();
        // Sombra en diagonal, como la de la mano o el celular
        const g = ctx.createLinearGradient(0, H * (0.3 + 0.2 * Math.sin(a.fase)), W, H * 0.7);
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(0.5, `rgba(0,0,0,${a.sombra})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        const d = ctx.getImageData(0, 0, W, H);
        for (let i = 0; i < d.data.length; i += 4) {
          const ruido = (Math.random() - 0.5) * a.ruido;
          d.data[i] += ruido;
          d.data[i + 1] += ruido;
          d.data[i + 2] += ruido;
        }
        ctx.putImageData(d, 0, 0);

        // La zona de productos, girada y escalada igual que la foto
        const rad = (a.giro * Math.PI) / 180;
        const esquinas = [
          [r.x, r.y],
          [r.x + r.ancho, r.y],
          [r.x, r.y + r.alto],
          [r.x + r.ancho, r.y + r.alto],
        ].map(([x, y]) => {
          const px = (x - img.naturalWidth / 2) * a.escala;
          const py = (y - img.naturalHeight / 2) * a.escala;
          return [W / 2 + px * Math.cos(rad) - py * Math.sin(rad), H / 2 + px * Math.sin(rad) + py * Math.cos(rad)];
        });
        const xs = esquinas.map((e) => e[0]);
        const ys = esquinas.map((e) => e[1]);
        const x = Math.max(0, Math.min(...xs) - 6);
        const y = Math.max(0, Math.min(...ys) - 6);
        return {
          jpg: c.toDataURL("image/jpeg", a.calidad).split(",")[1],
          recorte: { x, y, ancho: Math.min(W - x, Math.max(...xs) - x + 6), alto: Math.min(H - y, Math.max(...ys) - y + 6) },
        };
      },
      { datos, tipo, a: ajustes, r: respuesta.recorte },
    );
    const nombre = `variantes/${base}-${String(v + 1).padStart(2, "0")}`;
    writeFileSync(`${nombre}.jpg`, Buffer.from(jpg, "base64"));
    writeFileSync(
      `${nombre}.json`,
      JSON.stringify({ formato: `real:${base}`, degradacion: nivel, ...respuesta, recorte, ajustes }, null, 2),
    );
    total++;
  }
}
await nav.close();
console.log(`${total} versiones de ${fotos.length} foto(s) real(es) en variantes/`);
