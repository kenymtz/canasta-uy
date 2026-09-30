import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
