import { lazy, Suspense, useEffect, useMemo, useState } from "react";

import { Canasta } from "./components/Canasta";
import { Encabezado } from "./components/Encabezado";
import { Resultados } from "./components/Resultados";
import { Resumen } from "./components/Resumen";
import { SumarTicket } from "./components/SumarTicket";
import { PUNTO_EN_EL_MAPA, Ubicacion } from "./components/Ubicacion";
import { api, type Ciudad, type Comercio, type Generico } from "./lib/api";
import { useCotizacion } from "./hooks/useCotizacion";
import { useCanasta } from "./store/canasta";

// MapLibre pesa unos 800 KB: se carga aparte para que el panel aparezca enseguida
const Mapa = lazy(() => import("./components/Mapa").then((m) => ({ default: m.Mapa })));

export default function App() {
  const {
    ubicacion,
    radioKm,
    items,
    presupuesto,
    listas,
    elegirUbicacion,
    setRadio,
    sumar,
    restar,
    quitar,
    vaciar,
    setPresupuesto,
    guardarLista,
    cargarLista,
    borrarLista,
  } = useCanasta();
  const [ultimoPrecio, setUltimoPrecio] = useState<string | null>(null);
  const [ciudades, setCiudades] = useState<Ciudad[]>([]);
  const [comercios, setComercios] = useState<Comercio[]>([]);
  const [genericos, setGenericos] = useState<Generico[]>([]);
  const [seleccionado, setSeleccionado] = useState<number | null>(null);
  const genericosPorNombre = useMemo(() => new Map(genericos.map((g) => [g.nombre, g])), [genericos]);
  const cotizacion = useCotizacion({ ubicacion, radioKm, items, presupuesto, genericos: genericosPorNombre });

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
      <section aria-label="Mapa de comercios" className="sticky top-0 h-[40dvh] lg:relative lg:h-full">
        <Suspense fallback={<div className="h-full w-full bg-fondo" />}>
          <Mapa
            centro={ubicacion}
            departamento={ubicacion?.departamento || null}
            radioKm={radioKm}
            comercios={comercios}
            resultados={cotizacion.resultados}
            seleccionado={seleccionado}
            onSeleccionar={setSeleccionado}
            onElegirPunto={elegirPunto}
          />
        </Suspense>
        {/* Sombra donde el panel se apoya sobre el mapa: hace que se note el borde dentado */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-linear-to-t from-[rgb(20_32_27_/_0.14)] to-transparent lg:inset-x-auto lg:inset-y-0 lg:right-0 lg:h-auto lg:w-10 lg:bg-linear-to-l"
        />
      </section>
      <aside className="panel-cortado fondo-pastel relative -mt-5 flex flex-col gap-8 px-5 pt-8 pb-16 lg:z-10 lg:mt-0 lg:-ml-2 lg:overflow-y-auto lg:px-8 lg:pt-10 lg:pl-10">
        <Encabezado
          ultimoPrecio={ultimoPrecio}
          comercios={ciudades.reduce((total, c) => total + c.comercios, 0)}
          productos={genericos.length}
          departamentos={new Set(ciudades.map((c) => c.departamento)).size}
        />
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
          listas={listas}
          onSumar={sumar}
          onRestar={restar}
          onQuitar={quitar}
          onVaciar={vaciar}
          onPresupuesto={setPresupuesto}
          onGuardarLista={guardarLista}
          onCargarLista={cargarLista}
          onBorrarLista={borrarLista}
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
        <SumarTicket />
        <Resumen mejor={cotizacion.fase === "listo" ? cotizacion.resultados[0] : undefined} />
      </aside>
    </div>
  );
}
