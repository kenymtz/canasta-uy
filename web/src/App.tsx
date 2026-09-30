import { useEffect, useState } from "react";

import { Encabezado } from "./components/Encabezado";
import { api } from "./lib/api";

export default function App() {
  const [ultimoPrecio, setUltimoPrecio] = useState<string | null>(null);

  useEffect(() => {
    api.salud().then((s) => setUltimoPrecio(s.ultimo_precio)).catch(() => {});
  }, []);

  return (
    // Escritorio: mapa fijo a la izquierda y panel con scroll a la derecha.
    // Celular: mapa arriba y el panel encima, con esquinas redondeadas, como una hoja.
    <div className="min-h-[100dvh] lg:grid lg:h-[100dvh] lg:grid-cols-[minmax(0,1fr)_460px]">
      <section
        aria-label="Mapa de comercios"
        className="sticky top-0 h-[40dvh] bg-linea lg:static lg:h-full"
      />
      <aside className="relative -mt-5 flex flex-col gap-8 rounded-t-[20px] bg-panel px-5 pt-7 pb-16 lg:mt-0 lg:overflow-y-auto lg:rounded-none lg:px-8 lg:pt-10">
        <Encabezado ultimoPrecio={ultimoPrecio} />
      </aside>
    </div>
  );
}
