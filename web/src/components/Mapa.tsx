import {
  AttributionControl,
  type GeoJSONSource,
  Map as MapaML,
  Marker,
  NavigationControl,
  setWorkerUrl,
} from "maplibre-gl";
import urlWorker from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { useEffect, useRef, useState } from "react";

import type { Comercio, ResultadoComercio } from "../lib/api";
import { formatoPlata } from "../lib/formato";
import { circulo, limitesCirculo } from "../lib/geo";

// MapLibre dibuja en un proceso aparte (worker). Vite reempaqueta la librería y rompe la ruta
// relativa a ese archivo, así que se la indicamos explícitamente.
setWorkerUrl(urlWorker);

// Estilos gratuitos y sin clave de OpenFreeMap (datos de OpenStreetMap)
const ESTILOS = {
  claro: "https://tiles.openfreemap.org/styles/positron",
  oscuro: "https://tiles.openfreemap.org/styles/dark",
};
const URUGUAY: [number, number] = [-56.0, -32.7];
const MAX_ETIQUETAS = 15; // con más, el mapa se vuelve ilegible

interface Props {
  centro: { lat: number; lon: number } | null;
  radioKm: number;
  comercios: Comercio[];
  resultados: ResultadoComercio[];
  seleccionado: number | null;
  onSeleccionar: (establecimientoId: number) => void;
  onElegirPunto: (lat: number, lon: number) => void;
}

const oscuro = () => window.matchMedia("(prefers-color-scheme: dark)").matches;
const sinMovimiento = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const token = (nombre: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();

/** Tiñe el fondo del mapa con el color de la web y agrega las capas propias. */
function prepararEstilo(mapa: MapaML) {
  for (const capa of mapa.getStyle().layers) {
    if (capa.type === "background") mapa.setPaintProperty(capa.id, "background-color", token("--color-fondo"));
  }
  const acento = token("--color-acento");
  if (!mapa.getSource("radio")) {
    mapa.addSource("radio", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    mapa.addLayer({ id: "radio-relleno", type: "fill", source: "radio", paint: { "fill-color": acento, "fill-opacity": 0.05 } });
    mapa.addLayer({
      id: "radio-borde",
      type: "line",
      source: "radio",
      paint: { "line-color": acento, "line-width": 1.5, "line-dasharray": [2, 2] },
    });
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

export function Mapa({ centro, radioKm, comercios, resultados, seleccionado, onSeleccionar, onElegirPunto }: Props) {
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
      center: URUGUAY,
      zoom: 5.4,
      attributionControl: false,
    });
    m.addControl(new NavigationControl({ showCompass: false }), "top-right");
    // Arriba: en el celular, el panel tapa la parte de abajo del mapa
    m.addControl(new AttributionControl({ compact: true }), "top-left");
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

    // Si el sistema cambia entre claro y oscuro, el mapa también
    const tema = window.matchMedia("(prefers-color-scheme: dark)");
    const alCambiarTema = () => m.setStyle(oscuro() ? ESTILOS.oscuro : ESTILOS.claro);
    tema.addEventListener("change", alCambiarTema);

    return () => {
      tema.removeEventListener("change", alCambiarTema);
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

