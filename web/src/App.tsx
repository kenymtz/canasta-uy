import { useEffect, useState } from "react";

import { Encabezado } from "./components/Encabezado";
import { Mapa } from "./components/Mapa";
import { PUNTO_EN_EL_MAPA, Ubicacion } from "./components/Ubicacion";
import { api, type Ciudad, type Comercio } from "./lib/api";
import { useCanasta } from "./store/canasta";

export default function App() {
  const { ubicacion, radioKm, elegirUbicacion, setRadio } = useCanasta();
  const [ultimoPrecio, setUltimoPrecio] = useState<string | null>(null);
  const [ciudades, setCiudades] = useState<Ciudad[]>([]);
  const [comercios, setComercios] = useState<Comercio[]>([]);

  useEffect(() => {
    api.salud().then((s) => setUltimoPrecio(s.ultimo_precio)).catch(() => {});
    api.ciudades().then(setCiudades).catch(() => {});
  }, []);

  // Comercios dentro del radio, para dibujarlos en el mapa
  useEffect(() => {
    if (!ubicacion) return setComercios([]);
    let vigente = true;
    api
      .comercios(ubicacion.lat, ubicacion.lon, radioKm)
      .then((c) => vigente && setComercios(c))
      .catch(() => vigente && setComercios([]));
    return () => {
      vigente = false;
    };
  }, [ubicacion, radioKm]);

  function elegirPunto(lat: number, lon: number) {
    // Se mantiene el departamento elegido para que los selectores sigan teniendo sentido
    elegirUbicacion({ departamento: ubicacion?.departamento ?? "", ciudad: PUNTO_EN_EL_MAPA, lat, lon });
  }

  return (
    // Escritorio: mapa fijo a la izquierda y panel con scroll a la derecha.
    // Celular: mapa arriba y el panel encima, con esquinas redondeadas, como una hoja.
    <div className="min-h-[100dvh] lg:grid lg:h-[100dvh] lg:grid-cols-[minmax(0,1fr)_460px]">
      <section aria-label="Mapa de comercios" className="sticky top-0 h-[40dvh] lg:static lg:h-full">
        <Mapa
          centro={ubicacion}
          radioKm={radioKm}
          comercios={comercios}
          resultados={[]}
          seleccionado={null}
          onSeleccionar={() => {}}
          onElegirPunto={elegirPunto}
        />
      </section>
      <aside className="relative -mt-5 flex flex-col gap-8 rounded-t-[20px] bg-panel px-5 pt-7 pb-16 lg:mt-0 lg:overflow-y-auto lg:rounded-none lg:px-8 lg:pt-10">
        <Encabezado ultimoPrecio={ultimoPrecio} />
        <Ubicacion
          ciudades={ciudades}
          ubicacion={ubicacion}
          radioKm={radioKm}
          onElegir={({ departamento, ciudad, lat, lon }) => elegirUbicacion({ departamento, ciudad, lat, lon })}
          onRadio={setRadio}
        />
      </aside>
    </div>
  );
}
