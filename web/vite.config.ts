import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Carpeta donde vive la web publicada: "/" en Cloudflare Pages; VITE_BASE la cambia si hace falta
  base: process.env.VITE_BASE ?? "/",
  // El único archivo grande es el del mapa (MapLibre, ~1 MB), y se carga aparte
  build: { chunkSizeWarningLimit: 1100 },
  // El worker del mapa usa import (es un módulo), así que se arma en ese formato
  worker: { format: "es" },
  server: {
    host: true,
    port: 5173,
    // "web" es el nombre del servicio en Docker: lo usa el script de capturas
    allowedHosts: ["web"],
    // En Docker sobre Windows, los cambios en la carpeta montada no generan eventos:
    // hay que revisar los archivos cada tanto para que la página se actualice sola.
    watch: process.env.VITE_POLLING ? { usePolling: true, interval: 300 } : undefined,
    // La web llama a /api/...; Vite lo reenvía a la API, así no hace falta configurar CORS
    proxy: {
      "/api": {
        target: process.env.API_URL ?? "http://localhost:8000",
        rewrite: (ruta) => ruta.replace(/^\/api/, ""),
      },
    },
  },
});
