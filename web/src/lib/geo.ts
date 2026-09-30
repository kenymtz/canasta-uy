// Cálculos geográficos chicos para el mapa (sin librerías: son pocas líneas).

import type { Feature, Polygon } from "geojson";

const RADIO_TIERRA_KM = 6371;

/** Polígono (GeoJSON) que aproxima un círculo de `km` alrededor de un punto. */
export function circulo(lat: number, lon: number, km: number, puntos = 72): Feature<Polygon> {
  const d = km / RADIO_TIERRA_KM;
  const latR = (lat * Math.PI) / 180;
  const lonR = (lon * Math.PI) / 180;
  const anillo: [number, number][] = [];
  for (let i = 0; i <= puntos; i++) {
    const rumbo = (2 * Math.PI * i) / puntos;
    const lat2 = Math.asin(Math.sin(latR) * Math.cos(d) + Math.cos(latR) * Math.sin(d) * Math.cos(rumbo));
    const lon2 =
      lonR + Math.atan2(Math.sin(rumbo) * Math.sin(d) * Math.cos(latR), Math.cos(d) - Math.sin(latR) * Math.sin(lat2));
    anillo.push([(lon2 * 180) / Math.PI, (lat2 * 180) / Math.PI]);
  }
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [anillo] } };
}

/** Rectángulo [[oeste, sur], [este, norte]] que contiene el círculo. */
export function limitesCirculo(lat: number, lon: number, km: number): [[number, number], [number, number]] {
  const dLat = (km / RADIO_TIERRA_KM) * (180 / Math.PI);
  const dLon = dLat / Math.cos((lat * Math.PI) / 180);
  return [
    [lon - dLon, lat - dLat],
    [lon + dLon, lat + dLat],
  ];
}
