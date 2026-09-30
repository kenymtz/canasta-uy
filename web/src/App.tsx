import { useEffect, useMemo, useState } from "react";

import { Canasta } from "./components/Canasta";
import { Encabezado } from "./components/Encabezado";
import { Mapa } from "./components/Mapa";
import { Resultados } from "./components/Resultados";
import { Resumen } from "./components/Resumen";
import { PUNTO_EN_EL_MAPA, Ubicacion } from "./components/Ubicacion";
import { api, type Ciudad, type Comercio, type Generico } from "./lib/api";
import { useCotizacion } from "./hooks/useCotizacion";
import { useCanasta } from "./store/canasta";

export default function App() {
  const { ubicacion, radioKm, items, presupuesto, elegirUbicacion, setRadio, sumar, restar, cargarBasica, vaciar, setPresupuesto } =
    useCanasta();
  const [ultimoPrecio, setUltimoPrecio] = useState<string | null>(null);
  const [ciudades, setCiudades] = useState<Ciudad[]>([]);
  const [comercios, setComercios] = useState<Comercio[]>([]);
  const [genericos, setGenericos] = useState<Generico[]>([]);
  const [seleccionado, setSeleccionado] = useState<number | null>(null);
  const cotizacion = useCotizacion({ ubicacion, radioKm, items, presupuesto });
  const genericosPorNombre = useMemo(() => new Map(genericos.map((g) => [g.nombre, g])), [genericos]);

  // Con resultados nuevos, no queda nada abierto en la lista
  useEffect(() => setSeleccionado(null), [cotizacion.resultados]);

  useEffect(() => {
    api.salud().then((s) => setUltimoPrecio(s.ultimo_precio)).catch(() => {});
    api.ciudades().then(setCiudades).catch(() => {});
    api.genericos().then(setGenericos).catch(() => {});
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
          resultados={cotizacion.resultados}
          seleccionado={seleccionado}
          onSeleccionar={setSeleccionado}
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
        <Canasta
          genericos={genericos}
          items={items}
          presupuesto={presupuesto}
          onSumar={sumar}
          onRestar={restar}
          onBasica={() => cargarBasica(genericos)}
          onVaciar={vaciar}
          onPresupuesto={setPresupuesto}
        />
        <Resultados
          fase={cotizacion.fase}
          resultados={cotizacion.resultados}
          error={cotizacion.error}
          genericos={genericosPorNombre}
          presupuesto={presupuesto}
          radioKm={radioKm}
          hayUbicacion={ubicacion !== null}
          hayProductos={Object.keys(items).length > 0}
          seleccionado={seleccionado}
          onSeleccionar={setSeleccionado}
          onAmpliar={() => setRadio(Math.min(radioKm + 5, 20))}
          onReintentar={cotizacion.reintentar}
        />
        <Resumen mejor={cotizacion.fase === "listo" ? cotizacion.resultados[0] : undefined} />
      </aside>
    </div>
  );
}
