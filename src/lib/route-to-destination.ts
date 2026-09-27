// Monta o payload de um DESTINO a partir de uma rota gravada (Bloco 3 / item 4:
// gravar rota pelo Explorar → destino pendente). PURO e testável (sem hook).
//
// A partir dos pontos capturados (lat/lng/ts), deriva: distância (haversine),
// ponto inicial, GeoJSON LineString e ganho de elevação (quando há altitude).

import { haversineMeters } from "@/lib/haversine";

export type RecordedPoint = { lat: number; lng: number; ts?: number; alt?: number };

export type DestinationDraft = {
  routeGeojson: GeoJSON.LineString;
  distanceKm: number;
  startLat: number;
  startLng: number;
  elevationGainM: number;
};

/**
 * Valida e monta o rascunho de destino. Lança quando o trajeto tem < 2 pontos
 * (não dá para criar destino sem rota). Distância em km (2 casas).
 */
export function buildDestinationDraft(points: RecordedPoint[]): DestinationDraft {
  if (!points || points.length < 2) {
    throw new Error("Trajeto insuficiente (mínimo de 2 pontos).");
  }
  let dist = 0;
  let gain = 0;
  let prevAlt: number | null = null;
  for (let i = 0; i < points.length; i++) {
    if (i > 0) dist += haversineMeters(points[i - 1], points[i]);
    const alt = points[i].alt;
    if (alt != null && Number.isFinite(alt)) {
      if (prevAlt != null && alt > prevAlt) gain += alt - prevAlt;
      prevAlt = alt;
    }
  }
  return {
    routeGeojson: { type: "LineString", coordinates: points.map((p) => [p.lng, p.lat]) },
    distanceKm: +(dist / 1000).toFixed(2),
    startLat: points[0].lat,
    startLng: points[0].lng,
    elevationGainM: Math.round(gain),
  };
}
