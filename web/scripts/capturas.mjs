// Capturas de la web en escritorio y celular, modo claro y oscuro, con una canasta real.
// Corre dentro de la imagen oficial de Playwright (ver README):
//   node capturas.mjs <url de la web> <carpeta de salida>
import { chromium } from "playwright";

const [url = "http://web:5173", salida = "/out"] = process.argv.slice(2);

const PANTALLAS = [
  { nombre: "escritorio", viewport: { width: 1440, height: 900 }, paginaCompleta: false },
  { nombre: "celular", viewport: { width: 390, height: 844 }, paginaCompleta: true, isMobile: true },
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
    const genericos = conApi?.ok
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
    await pagina.getByLabel("Departamento").selectOption("Salto");
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

await navegador.close();
console.log(errores.length ? `errores de consola:\n${errores.join("\n")}` : "consola sin errores");
