// Capturas de la web en escritorio y celular, modo claro y oscuro, con una canasta real.
// Corre dentro de la imagen oficial de Playwright (ver README):
//   node capturas.mjs <url de la web> <carpeta de salida>
import { chromium } from "playwright";

const [url = "http://web:5173", salida = "/out"] = process.argv.slice(2);

const PANTALLAS = [
  // La portada usa Montevideo: es la capital, tiene ~500 comercios (el mapa se ve lleno) y el
  // río queda solo en el borde. El celular usa Salto, que entra entero en la pantalla angosta.
  { nombre: "escritorio", viewport: { width: 1440, height: 900 }, paginaCompleta: false, ciudad: "Montevideo" },
  { nombre: "celular", viewport: { width: 390, height: 844 }, paginaCompleta: true, isMobile: true, ciudad: "Salto" },
];

// Listas de ejemplo que quedan guardadas antes de sacar las capturas
const LISTAS = {
  "Compra del mes": [
    ["Arroz blanco", 2], ["Fideos semolados", 1], ["Aceite de girasol", 0.9], ["Azúcar", 1],
    ["Yerba mate", 1], ["Harina de trigo 0000", 1], ["Huevos", 12], ["Manteca", 0.2],
    ["Carne picada", 1], ["Pollo entero", 1.5], ["Papa", 2], ["Tomate", 1], ["Manzana", 1],
    ["Detergente para vajilla", 1], ["Hipoclorito de sodio", 1], ["Papel higiénico", 120],
  ],
  "Asado del domingo": [["Aguja vacuna", 2], ["Chorizos", 1], ["Pan flauta", 0.5], ["Vino tinto", 1]],
};

async function guardarListas(pagina) {
  await pagina.evaluate(async (listas) => {
    // Con API (desarrollo) o, en la web estática, desde los archivos exportados
    const conApi = await fetch("/api/genericos").catch(() => null);
    // (Cloudflare Pages responde las rutas desconocidas con la página, no con un 404)
    const genericos = conApi?.ok && conApi.headers.get("content-type")?.includes("json")
      ? await conApi.json()
      : (await (await fetch("datos/base.json")).json()).genericos;
    const nombres = new Set(genericos.map((g) => g.nombre));
    const guardadas = Object.entries(listas).map(([nombre, productos]) => ({
      nombre,
      items: Object.fromEntries(productos.filter(([n]) => nombres.has(n))),
      guardada: new Date().toISOString(),
    }));
    const estado = { ubicacion: null, radioKm: 5, items: {}, presupuesto: null, listas: guardadas };
    localStorage.setItem("canasta-uy", JSON.stringify({ state: estado, version: 2 }));
  }, LISTAS);
}

const navegador = await chromium.launch();
const errores = [];

for (const pantalla of PANTALLAS) {
  for (const tema of ["light", "dark"]) {
    const contexto = await navegador.newContext({
      viewport: pantalla.viewport,
      deviceScaleFactor: 2,
      isMobile: pantalla.isMobile ?? false,
      colorScheme: tema,
      reducedMotion: "reduce", // capturas estables, sin animaciones a medio camino
      locale: "es-UY",
    });
    const pagina = await contexto.newPage();
    pagina.on("console", (m) => m.type() === "error" && errores.push(`[${pantalla.nombre}/${tema}] ${m.text()}`));
    pagina.on("pageerror", (e) => errores.push(`[${pantalla.nombre}/${tema}] ${e.message}`));

    await pagina.goto(url, { waitUntil: "networkidle" });
    await guardarListas(pagina);
    await pagina.reload({ waitUntil: "networkidle" });
    await pagina.getByLabel("Departamento").selectOption(pantalla.ciudad);
    await pagina.getByRole("button", { name: /^Compra del mes/ }).click();
    await pagina.getByRole("article", { name: /Ticket de/ }).waitFor({ timeout: 15000 });
    await pagina.waitForTimeout(1500); // que terminen de cargar los mosaicos del mapa

    const base = `${salida}/${pantalla.nombre}-${tema === "light" ? "claro" : "oscuro"}`;
    await pagina.getByRole("article", { name: /Ticket de/ }).screenshot({ path: `${base}-ticket.png` });
    // Tocar botones desplaza la página: se vuelve arriba para ver el mapa
    await pagina.evaluate(() => {
      window.scrollTo(0, 0);
      document.querySelector("aside")?.scrollTo(0, 0); // en escritorio el panel tiene su propio scroll
    });
    await pagina.waitForTimeout(300);
    await pagina.screenshot({ path: `${base}.png` });
    console.log("captura:", `${base}.png`);
    if (pantalla.paginaCompleta) {
      await pagina.screenshot({ path: `${base}-completa.png`, fullPage: true });
      console.log("captura:", `${base}-completa.png`);
    }
    await contexto.close();
  }
}

// "Mis compras" con dos compras inventadas (no son tickets reales)
{
  const contexto = await navegador.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    colorScheme: "light",
    reducedMotion: "reduce",
    locale: "es-UY",
  });
  const pagina = await contexto.newPage();
  await pagina.goto(url, { waitUntil: "networkidle" });
  await pagina.evaluate(() => {
    const comercio = { establecimiento_id: 1, nombre: "Ta - Ta - Hiper Salto", direccion: "19 de Abril y Soca", ciudad: "Salto" };
    const producto = (descripcion, precio) => ({ descripcion, precio });
    const compras = [
      {
        id: "ejemplo-1", fecha: "2026-09-02", total: 1012.4, ruc: "219999990019", comercio, guardada: "2026-09-02T18:00:00Z",
        productos: [producto("ACEITE GIRASOL 900CC", 79), producto("ARROZ BLANCO 1KG", 51), producto("YERBA MATE 1KG", 186), producto("LECHE ENTERA 1L", 42.5)],
      },
      {
        id: "ejemplo-2", fecha: "2026-09-30", total: 1087.9, ruc: "219999990019", comercio, guardada: "2026-09-30T18:00:00Z",
        productos: [producto("ACEITE GIRASOL 900CC", 94), producto("ARROZ BLANCO 1KG", 51), producto("YERBA MATE 1KG", 179), producto("LECHE ENTERA 1L", 44.9)],
      },
    ];
    localStorage.setItem("canasta-uy-compras", JSON.stringify({ state: { compras }, version: 1 }));
  });
  await pagina.reload({ waitUntil: "networkidle" });
  const mis = pagina.getByRole("region", { name: "Mis compras" });
  await mis.getByRole("button").first().click(); // abre la compra más nueva
  await pagina.waitForTimeout(300);
  await mis.screenshot({ path: `${salida}/celular-claro-compras.png` });
  console.log("captura:", `${salida}/celular-claro-compras.png`);
  await contexto.close();
}

await navegador.close();
console.log(errores.length ? `errores de consola:\n${errores.join("\n")}` : "consola sin errores");
