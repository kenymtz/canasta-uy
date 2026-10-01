import {
  AttributionControl,
  type FilterSpecification,
  type GeoJSONSource,
  Map as MapaML,
  Marker,
  NavigationControl,
  setWorkerUrl,
} from "maplibre-gl";
import urlWorker from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { useEffect, useRef, useState } from "react";

import type { FeatureCollection, Polygon } from "geojson";

import type { Comercio, ResultadoComercio } from "../lib/api";
import { formatoPlata } from "../lib/formato";
import { temaActual } from "../lib/tema";
import { circulo, limitesCirculo } from "../lib/geo";
import { rutaPublica } from "../lib/rutas";

// MapLibre dibuja en un proceso aparte (worker). Vite reempaqueta la librería y rompe la ruta
// relativa a ese archivo, así que se la indicamos explícitamente. "?worker&url" arma el
// worker junto con lo que importa (maplibre-gl-shared.mjs); con "?url" solo, la versión
// compilada copiaba el archivo suelto y el mapa no cargaba.
setWorkerUrl(urlWorker);

// Estilos gratuitos y sin clave de OpenFreeMap (datos de OpenStreetMap)
const ESTILOS = {
  claro: "https://tiles.openfreemap.org/styles/positron",
  oscuro: "https://tiles.openfreemap.org/styles/dark",
};
// Uruguay entero: así arranca el mapa, antes de elegir ubicación
const URUGUAY: [[number, number], [number, number]] = [
  [-58.45, -35.0],
  [-53.1, -30.1],
];
// Rectángulo de Uruguay con un margen chico: el mapa no se puede mover ni alejar fuera de él
const LIMITES_URUGUAY: [[number, number], [number, number]] = [
  [-59.0, -35.3],
  [-52.6, -29.7],
];
const MAX_ETIQUETAS = 15; // con más, el mapa se vuelve ilegible

// Contorno de Uruguay y de sus 19 departamentos (geoBoundaries, a partir de OpenStreetMap,
// licencia ODbL), guardados en web/public/geo. El contorno sirve para dos cosas: armar una
// "máscara" (el mundo entero con un agujero con la forma de Uruguay) que oscurece lo de
// afuera, y mostrar solo los nombres de lugares que están dentro del país.
const PAIS = fetch(rutaPublica("geo/uruguay.geojson"))
  .then((r) => r.json())
  .then((fc: FeatureCollection<Polygon>) => fc.features[0].geometry);

const MASCARA = PAIS.then((pais) => ({
  type: "Feature" as const,
  properties: {},
  geometry: {
    type: "Polygon" as const,
    coordinates: [
      [
        [-180, -85],
        [180, -85],
        [180, 85],
        [-180, 85],
        [-180, -85],
      ],
      pais.coordinates[0],
    ],
  },
}));

interface Props {
  centro: { lat: number; lon: number } | null;
  departamento: string | null;
  radioKm: number;
  comercios: Comercio[];
  resultados: ResultadoComercio[];
  seleccionado: number | null;
  onSeleccionar: (establecimientoId: number) => void;
  onElegirPunto: (lat: number, lon: number) => void;
}

const oscuro = () => temaActual() === "oscuro";
const sinMovimiento = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const token = (nombre: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();

/** Tiñe el fondo del mapa con el color de la web y agrega las capas propias. */
function prepararEstilo(mapa: MapaML) {
  const capasBase = mapa.getStyle().layers;
  for (const capa of capasBase) {
    if (capa.type === "background") mapa.setPaintProperty(capa.id, "background-color", token("--color-fondo"));
    // Los límites del mapa base son grises y punteados; se reemplazan por los propios
    if (capa.id.startsWith("boundary")) mapa.setLayoutProperty(capa.id, "visibility", "none");
  }
  const acento = token("--color-acento");

  // Las capas propias (máscara, límites, radio) van por debajo de los nombres del mapa, para
  // que ninguna línea tape un nombre; solo los puntos de los comercios van encima.
  const debajoDeLosNombres = capasBase.find((c) => c.type === "symbol")?.id;

  // Solo los nombres de lugares dentro de Uruguay: se suma la condición "within" al filtro
  // que ya trae cada capa de texto del mapa base
  const nombres = capasBase.filter((c) => c.type === "symbol").map((c) => c.id);
  PAIS.then((pais) => {
    for (const id of nombres) {
      if (!mapa.getLayer(id)) continue;
      const filtro = mapa.getFilter(id);
      const dentro = ["within", { type: "Feature", properties: {}, geometry: pais }];
      mapa.setFilter(id, (filtro ? ["all", filtro, dentro] : dentro) as FilterSpecification);
    }
  });

  if (!mapa.getSource("mascara")) {
    mapa.addSource("mascara", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    mapa.addLayer({
      id: "fuera-de-uruguay",
      type: "fill",
      source: "mascara",
      // Fuerte en la vista de país; se desvanece al acercarse a una ciudad, donde el contorno
      // simplificado ya no coincide exactamente con la costa o el río
      paint: {
        "fill-color": token("--color-fondo"),
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 6, oscuro() ? 0.8 : 0.72, 9, 0.45, 11, 0],
      },
    }, debajoDeLosNombres);
    MASCARA.then((m) => mapa.getSource<GeoJSONSource>("mascara")?.setData(m));
  }
  if (!mapa.getSource("departamentos")) {
    mapa.addSource("departamentos", { type: "geojson", data: rutaPublica("geo/departamentos.geojson") });
    mapa.addSource("uruguay", { type: "geojson", data: rutaPublica("geo/uruguay.geojson") });
    // El departamento elegido se tiñe; el filtro se actualiza desde el componente
    mapa.addLayer({
      id: "departamento-elegido",
      type: "fill",
      source: "departamentos",
      filter: ["==", ["get", "nombre"], ""],
      paint: { "fill-color": acento, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0.12, 11, 0.04] },
    }, debajoDeLosNombres);
    mapa.addLayer({
      id: "limites-departamentos",
      type: "line",
      source: "departamentos",
      paint: {
        "line-color": token("--color-tinta-suave"),
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0.6, 10, 0.3, 12, 0],
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.9, 10, 1.6],
      },
    }, debajoDeLosNombres);
    mapa.addLayer({
      id: "limite-elegido",
      type: "line",
      source: "departamentos",
      filter: ["==", ["get", "nombre"], ""],
      paint: {
        "line-color": acento,
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 9, 1, 12, 0],
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1.5, 10, 2.5],
      },
    }, debajoDeLosNombres);
    mapa.addLayer({
      id: "limite-uruguay",
      type: "line",
      source: "uruguay",
      paint: {
        "line-color": token("--color-tinta"),
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0.75, 10, 0.3, 12, 0],
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1.3, 10, 2.2],
      },
    }, debajoDeLosNombres);
  }
  if (!mapa.getSource("radio")) {
    mapa.addSource("radio", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    mapa.addLayer(
      { id: "radio-relleno", type: "fill", source: "radio", paint: { "fill-color": acento, "fill-opacity": 0.05 } },
      debajoDeLosNombres,
    );
    mapa.addLayer({
      id: "radio-borde",
      type: "line",
      source: "radio",
      paint: { "line-color": acento, "line-width": 1.5, "line-dasharray": [2, 2] },
    }, debajoDeLosNombres);
  }
  if (!mapa.getSource("comercios")) {
    mapa.addSource("comercios", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    mapa.addLayer({
      id: "comercios",
      type: "circle",
      source: "comercios",
      paint: {
        "circle-radius": 4,
        "circle-color": token("--color-tinta-suave"),
        "circle-stroke-color": token("--color-ticket"),
        "circle-stroke-width": 1.5,
      },
    });
  }
}

/**
 * Oculta las etiquetas que se pisan con otra más importante. Vienen ordenadas de la más
 * conveniente a la menos; el comercio elegido (data-activo) va primero. Las ocultas siguen
 * viéndose como punto en la capa de comercios.
 */
function evitarSolapes(etiquetas: Marker[]) {
  const orden = [...etiquetas].sort(
    (a, b) => Number(b.getElement().dataset.activo === "true") - Number(a.getElement().dataset.activo === "true"),
  );
  const ocupadas: DOMRect[] = [];
  for (const marcador of orden) {
    const el = marcador.getElement();
    const r = el.getBoundingClientRect();
    const choca = ocupadas.some((o) => r.left < o.right + 4 && r.right > o.left - 4 && r.top < o.bottom + 2 && r.bottom > o.top - 2);
    el.style.visibility = choca ? "hidden" : "visible";
    if (!choca) ocupadas.push(r);
  }
}

export function Mapa({ centro, departamento, radioKm, comercios, resultados, seleccionado, onSeleccionar, onElegirPunto }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaML | null>(null);
  // Sube cada vez que el estilo termina de cargar (también tras un cambio de tema), para que
  // los efectos que usan las capas propias se vuelvan a aplicar
  const [listo, setListo] = useState(0);
  const etiquetas = useRef<Marker[]>([]);
  const puntoUsuario = useRef<Marker | null>(null);
  // Las funciones del padre cambian en cada render; el mapa usa siempre la última
  const callbacks = useRef({ onSeleccionar, onElegirPunto });
  callbacks.current = { onSeleccionar, onElegirPunto };

  // Crear el mapa una sola vez
  useEffect(() => {
    if (!contenedor.current) return;
    const m = new MapaML({
      container: contenedor.current,
      style: oscuro() ? ESTILOS.oscuro : ESTILOS.claro,
      bounds: URUGUAY,
      fitBoundsOptions: { padding: 24 },
      maxBounds: LIMITES_URUGUAY,
      attributionControl: false,
    });
    m.addControl(new NavigationControl({ showCompass: false }), "top-right");
    // Arriba: en el celular, el panel tapa la parte de abajo del mapa
    m.addControl(
      new AttributionControl({ compact: true, customAttribution: "Límites: geoBoundaries (ODbL)" }),
      "top-left",
    );
    // Los créditos arrancan desplegados y en el celular tapan el zoom: se muestran plegados
    // (siguen a un toque en el ícono de información)
    m.once("load", () => contenedor.current?.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show"));
    m.on("style.load", () => {
      prepararEstilo(m);
      setListo((n) => n + 1);
    });
    m.on("click", (e) => {
      // Un clic en una etiqueta de precio no cuenta como elegir punto
      if ((e.originalEvent.target as HTMLElement).closest(".pin")) return;
      callbacks.current.onElegirPunto(e.lngLat.lat, e.lngLat.lng);
    });
    // Al mover o hacer zoom cambian las distancias en pantalla entre etiquetas
    m.on("moveend", () => evitarSolapes(etiquetas.current));
    mapa.current = m;

    // Cuando cambia el tema (botón o sistema), el mapa cambia de estilo
    const observador = new MutationObserver(() => m.setStyle(oscuro() ? ESTILOS.oscuro : ESTILOS.claro));
    observador.observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema"] });

    return () => {
      observador.disconnect();
      m.remove();
      mapa.current = null;
    };
  }, [setListo]);

  // Radio y punto del usuario; encuadra el círculo
  useEffect(() => {
    const m = mapa.current;
    if (!m || !listo) return;
    const fuente = m.getSource<GeoJSONSource>("radio");
    puntoUsuario.current?.remove();
    if (!centro) {
      fuente?.setData({ type: "FeatureCollection", features: [] });
      return;
    }
    fuente?.setData(circulo(centro.lat, centro.lon, radioKm));
    const punto = document.createElement("div");
    punto.setAttribute("aria-label", "Tu ubicación");
    punto.className = "size-4 rounded-full border-[3px] border-ticket bg-acento shadow-[0_0_0_6px_rgb(22_122_79_/_0.18)]";
    puntoUsuario.current = new Marker({ element: punto }).setLngLat([centro.lon, centro.lat]).addTo(m);
    m.fitBounds(limitesCirculo(centro.lat, centro.lon, radioKm), {
      padding: 36,
      duration: sinMovimiento() ? 0 : 700,
    });
  }, [centro, radioKm, listo]);

  // Resaltar el departamento elegido
  useEffect(() => {
    const m = mapa.current;
    if (!m || !listo) return;
    const filtro: ["==", ["get", string], string] = ["==", ["get", "nombre"], departamento ?? ""];
    m.setFilter("departamento-elegido", filtro);
    m.setFilter("limite-elegido", filtro);
  }, [departamento, listo]);

  // Comercios cercanos como puntos chicos
  useEffect(() => {
    const m = mapa.current;
    if (!m || !listo) return;
    m.getSource<GeoJSONSource>("comercios")?.setData({
      type: "FeatureCollection",
      features: comercios.map((c) => ({
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: [c.lon, c.lat] },
      })),
    });
  }, [comercios, listo]);

  // Etiquetas con el total de cada comercio cotizado
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    for (const e of etiquetas.current) e.remove();
    etiquetas.current = [];
    const posicion = new Map(comercios.map((c) => [c.establecimiento_id, c]));
    resultados.slice(0, MAX_ETIQUETAS).forEach((r, i) => {
      const c = posicion.get(r.establecimiento_id);
      if (!c) return;
      // Un comercio incompleto parece más barato solo porque le faltan cosas: en lugar del
      // precio, la etiqueta dice cuántos productos le faltan
      const completo = r.cobertura === 1;
      const faltan = r.productos_pedidos - r.productos_con_precio;
      const boton = document.createElement("button");
      boton.type = "button";
      boton.textContent = completo ? formatoPlata(r.total) : `Faltan ${faltan}`;
      boton.setAttribute(
        "aria-label",
        completo ? `${r.comercio}: ${formatoPlata(r.total)}` : `${r.comercio}: le faltan ${faltan} productos`,
      );
      boton.dataset.activo = String(r.establecimiento_id === seleccionado);
      boton.className = [
        "pin numeros cursor-pointer rounded-full px-2.5 py-1 text-[12px] font-medium whitespace-nowrap",
        i === 0 && completo
          ? "bg-acento text-sobre-acento"
          : completo
            ? "bg-ticket text-tinta ring-1 ring-linea"
            : "bg-panel text-tinta-suave ring-1 ring-linea",
        r.establecimiento_id === seleccionado ? "ring-2 ring-acento" : "",
      ].join(" ");
      boton.addEventListener("click", () => callbacks.current.onSeleccionar(r.establecimiento_id));
      // El mejor queda arriba de los demás
      boton.style.zIndex = String(MAX_ETIQUETAS - i);
      etiquetas.current.push(new Marker({ element: boton }).setLngLat([c.lon, c.lat]).addTo(m));
    });
    requestAnimationFrame(() => evitarSolapes(etiquetas.current));
  }, [resultados, comercios, seleccionado]);

  return <div ref={contenedor} className="h-full w-full" />;
}

