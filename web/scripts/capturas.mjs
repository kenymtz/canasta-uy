// Capturas de la web en escritorio y celular, modo claro y oscuro, con una canasta real.
// Corre dentro de la imagen oficial de Playwright (ver README):
//   node capturas.mjs <url de la web> <carpeta de salida>
import { chromium } from "playwright";

const [url = "http://web:5173", salida = "/out"] = process.argv.slice(2);

const PANTALLAS = [
  { nombre: "escritorio", viewport: { width: 1440, height: 900 }, paginaCompleta: false },
  { nombre: "celular", viewport: { width: 390, height: 844 }, paginaCompleta: true, isMobile: true },
];

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
    await pagina.getByLabel("Departamento").selectOption("Salto");
    await pagina.getByRole("button", { name: "Canasta básica" }).click();
    await pagina.getByRole("article", { name: /Ticket de/ }).waitFor({ timeout: 15000 });
    await pagina.waitForTimeout(1500); // que terminen de cargar los mosaicos del mapa

    const base = `${salida}/${pantalla.nombre}-${tema === "light" ? "claro" : "oscuro"}`;
    await pagina.getByRole("article", { name: /Ticket de/ }).screenshot({ path: `${base}-ticket.png` });
    // Tocar botones desplaza la página: se vuelve arriba para ver el mapa
    await pagina.evaluate(() => window.scrollTo(0, 0));
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
