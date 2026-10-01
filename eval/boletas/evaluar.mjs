// Pasa cada boleta por el mismo lector de la web y mide qué tan bien lee.
//
//   node evaluar.mjs [carpeta ...]          (por defecto: generadas, reales y variantes)
//
// Usa el código de la web tal cual: abre la web de desarrollo (WEB_URL) y, dentro de la
// página, importa src/lib/lectorBoleta.ts (foto → texto) y src/lib/boleta.ts (texto →
// productos). Cada imagen se lee de dos formas:
//   recorte:  solo la zona de productos, como se le pide al usuario
//   completa: la foto entera, como hace mucha gente igual
//
// Métricas por boleta (y promedio por formato, nivel de foto y forma de lectura):
//   encontrados  productos reales que aparecen en la lectura (descripción parecida)
//   precio ok    de esos, cuántos con el precio exacto
//   basura       renglones leídos como producto que no lo son
//   fugas        datos personales o de pago que llegaron a la lista (tiene que ser 0)

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { chromium } from "playwright";

const WEB = process.env.WEB_URL ?? "http://web:5173";
const CARPETAS = process.argv.slice(2).length ? process.argv.slice(2) : ["generadas", "reales", "variantes"];
const PARECIDO_MINIMO = 0.8;
// Para probar otra preparación de la imagen sin tocar la web: OCR_ANCHO=2400 OCR_NIVELES=0
// OCR_FONDO=30 (los que no se indican quedan como en la web: web/src/lib/lectorBoleta.ts)
const PREPARACION =
  process.env.OCR_ANCHO || process.env.OCR_NIVELES || process.env.OCR_FONDO
    ? Object.fromEntries(
        [
          ["ancho", process.env.OCR_ANCHO],
          ["niveles", process.env.OCR_NIVELES],
          ["fondo", process.env.OCR_FONDO],
        ].filter(([, v]) => v).map(([k, v]) => [k, Number(v)]),
      )
    : null;
if (PREPARACION) console.log("Preparación de prueba:", PREPARACION);

// ─── Comparar descripciones ──────────────────────────────────────────────────
const normalizar = (s) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

function distancia(a, b) {
  const fila = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = fila[0];
    fila[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const arriba = fila[j];
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = arriba;
    }
  }
  return fila[b.length];
}

/** 1 = iguales; 0 = nada que ver (sin mirar mayúsculas, tildes, espacios ni signos). */
function parecido(a, b) {
  const [x, y] = [normalizar(a), normalizar(b)];
  if (!x.length && !y.length) return 1;
  return 1 - distancia(x, y) / Math.max(x.length, y.length);
}

function puntuar(esperados, leidos, sensibles) {
  const libres = [...leidos];
  let encontrados = 0;
  let preciosOk = 0;
  for (const e of esperados) {
    let mejor = -1;
    let mejorParecido = PARECIDO_MINIMO;
    libres.forEach((l, i) => {
      const p = parecido(e.descripcion, l.descripcion);
      if (p >= mejorParecido) [mejor, mejorParecido] = [i, p];
    });
    if (mejor === -1) continue;
    encontrados++;
    if (Math.abs(libres[mejor].precio - e.precio) < 0.005) preciosOk++;
    libres.splice(mejor, 1);
  }
  // Palabra entera: "ANA" (un nombre) no es una fuga dentro de "MANZANA"
  const texto = leidos.map((l) => l.descripcion).join("\n").toUpperCase();
  const comoPalabra = (s) => new RegExp(`(^|[^\\p{L}\\d])${String(s).toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\d])`, "u");
  const fugas = sensibles.filter((s) => comoPalabra(s).test(texto));
  return { esperados: esperados.length, encontrados, preciosOk, basura: libres.length, fugas };
}

// ─── Leer con el código de la web ────────────────────────────────────────────
const nav = await chromium.launch();
const pagina = await nav.newPage();
await pagina.goto(WEB, { waitUntil: "networkidle" });

async function leer(archivo, recorte) {
  const datos = readFileSync(archivo).toString("base64");
  const tipo = archivo.endsWith(".png") ? "image/png" : archivo.endsWith(".webp") ? "image/webp" : "image/jpeg";
  return pagina.evaluate(
    async ({ datos, tipo, recorte, preparacion }) => {
      const { leerTexto } = await import("/src/lib/lectorBoleta.ts");
      const { leerBoleta } = await import("/src/lib/boleta.ts");
      const img = new Image();
      img.src = `data:${tipo};base64,${datos}`;
      await img.decode();
      const zona = recorte ?? { x: 0, y: 0, ancho: img.naturalWidth, alto: img.naturalHeight };
      // Igual que la web (todas sus pasadas), o una sola preparación de prueba si se pidió
      const { PASADAS, PREPARACION: deLaWeb } = await import("/src/lib/lectorBoleta.ts");
      const pasadas = preparacion ? [{ ...deLaWeb, ...preparacion }] : PASADAS;
      const texto = await leerTexto(img, zona, () => {}, pasadas, (t) => leerBoleta(t).productos.length);
      return { texto, ...leerBoleta(texto) };
    },
    { datos, tipo, recorte, preparacion: PREPARACION },
  );
}

// ─── Recorrer las boletas ────────────────────────────────────────────────────
const resultados = [];
for (const carpeta of CARPETAS) {
  if (!existsSync(carpeta)) continue;
  const imagenes = readdirSync(carpeta).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
  for (const imagen of imagenes) {
    const respuesta = join(carpeta, imagen.replace(/\.(jpe?g|png|webp)$/i, ".json"));
    if (!existsSync(respuesta)) {
      console.log(`  (sin ${basename(respuesta)}: se saltea ${imagen})`);
      continue;
    }
    const esperado = JSON.parse(readFileSync(respuesta, "utf-8"));
    // Las fotos reales y sus versiones pueden tener datos personales
    const real = carpeta.endsWith("reales") || carpeta.endsWith("variantes");
    const formas = esperado.recorte ? ["recorte", "completa"] : ["completa"];
    for (const forma of formas) {
      const inicio = Date.now();
      const lectura = await leer(join(carpeta, imagen), forma === "recorte" ? esperado.recorte : null);
      const nota = puntuar(esperado.productos, lectura.productos, esperado.sensibles ?? []);
      resultados.push({
        imagen: join(carpeta, imagen),
        formato: esperado.formato ?? `real:${imagen.replace(/\.(jpe?g|png|webp)$/i, "")}`,
        degradacion: esperado.degradacion ?? "original",
        forma,
        segundos: Math.round((Date.now() - inicio) / 100) / 10,
        ...nota,
        leidos: lectura.productos,
        // El texto completo de una foto real puede tener datos personales: no se guarda (salvo
        // en las boletas inventadas, marcadas así en su .json, que sirven para depurar)
        texto: real && !/INVENTADA/.test(esperado.nota ?? "") ? undefined : lectura.texto,
      });
      const r = resultados.at(-1);
      console.log(
        `${r.imagen.padEnd(22)} ${r.forma.padEnd(9)} ${String(r.encontrados).padStart(2)}/${r.esperados} encontrados, ` +
          `${r.preciosOk} precios ok, ${r.basura} basura${r.fugas.length ? `, FUGAS: ${r.fugas.length}` : ""}  (${r.segundos} s)`,
      );
    }
  }
}
await nav.close();

// ─── Resumen ─────────────────────────────────────────────────────────────────
function resumir(clave) {
  const grupos = new Map();
  for (const r of resultados) {
    const k = clave(r);
    const g = grupos.get(k) ?? { esperados: 0, encontrados: 0, preciosOk: 0, basura: 0, fugas: 0, boletas: 0 };
    g.esperados += r.esperados;
    g.encontrados += r.encontrados;
    g.preciosOk += r.preciosOk;
    g.basura += r.basura;
    g.fugas += r.fugas.length;
    g.boletas++;
    grupos.set(k, g);
  }
  return [...grupos].map(([grupo, g]) => ({
    grupo,
    boletas: g.boletas,
    "encontrados %": Math.round((100 * g.encontrados) / g.esperados),
    "precio ok %": Math.round((100 * g.preciosOk) / g.esperados),
    "basura x boleta": Math.round((10 * g.basura) / g.boletas) / 10,
    fugas: g.fugas,
  }));
}

if (resultados.length) {
  const porForma = resumir((r) => r.forma);
  console.log("\nPor forma de lectura");
  console.table(porForma);
  console.log("Por nivel de foto (solo recorte)");
  console.table(resumir((r) => (r.forma === "recorte" ? r.degradacion : "—")).filter((g) => g.grupo !== "—"));
  const reales = resultados.filter((r) => r.formato.startsWith("real:"));
  if (reales.length) {
    console.log("Fotos reales y sus versiones, por nivel (recorte y foto completa)");
    console.table(
      resumir((r) => (r.formato.startsWith("real:") ? `${r.formato} ${r.degradacion} ${r.forma}` : "—")).filter(
        (g) => g.grupo !== "—",
      ),
    );
  }
  console.log("Por formato de ticket (solo recorte)");
  console.table(resumir((r) => (r.forma === "recorte" ? r.formato : "—")).filter((g) => g.grupo !== "—"));

  mkdirSync("resultados", { recursive: true });
  const archivo = `resultados/${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;
  writeFileSync(archivo, JSON.stringify({ resumen: porForma, boletas: resultados }, null, 2));
  console.log(`Detalle en ${archivo}`);
  const fugas = resultados.reduce((t, r) => t + r.fugas.length, 0);
  if (fugas) {
    console.error(`\n¡${fugas} datos sensibles llegaron a la lista de productos!`);
    process.exitCode = 1;
  }
} else {
  console.log("No hay boletas para evaluar. Corré primero: node generar.mjs");
}
