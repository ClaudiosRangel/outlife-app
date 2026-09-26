// Import de rota a partir de GPX (Bloco 3). Função PURA (testável, sem
// Capacitor/DOM): extrai nome/descrição/pontos do trajeto e deriva distância,
// ponto inicial, bounding box e o GeoJSON LineString. Valida o mínimo (>= 2
// pontos com coordenadas válidas). KML/KMZ ficam como extensão posterior.

import { haversineMeters } from "@/lib/haversine";

export type GpxPoint = { lat: number; lng: number; ele: number | null };

export type GpxRoute = {
  name: string | null;
  description: string | null;
  points: GpxPoint[];
  distanceMeters: number;
  start: { lat: number; lng: number } | null;
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number } | null;
  geojson: GeoJSON.LineString | null;
  hasElevation: boolean;
};

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function firstMatch(xml: string, re: RegExp): string | null {
  const m = xml.match(re);
  return m ? decodeEntities(m[1].trim()) : null;
}

/**
 * Parseia um GPX (string XML). Lança Error com mensagem clara quando o arquivo
 * não tem trajeto utilizável (< 2 pontos válidos).
 */
export function parseGpx(xml: string): GpxRoute {
  if (typeof xml !== "string" || xml.trim().length === 0) {
    throw new Error("Arquivo GPX vazio ou inválido.");
  }

  // Nome/descrição: preferir os de <metadata>, com fallback para <trk>.
  const metaBlock = xml.match(/<metadata>([\s\S]*?)<\/metadata>/)?.[1] ?? "";
  const name =
    firstMatch(metaBlock, /<name>([\s\S]*?)<\/name>/) ??
    firstMatch(xml, /<name>([\s\S]*?)<\/name>/);
  const description =
    firstMatch(metaBlock, /<desc>([\s\S]*?)<\/desc>/) ??
    firstMatch(xml, /<desc>([\s\S]*?)<\/desc>/);

  // Pontos: trkpt (preferencial) ou rtept, na ordem do arquivo. `ele` opcional.
  const points: GpxPoint[] = [];
  // Aceita número decimal com sinal e notação científica opcional (robustez).
  const re = /<(?:trkpt|rtept)\s+[^>]*?lat="([-\d.eE+]+)"[^>]*?lon="([-\d.eE+]+)"[^>]*?(?:\/>|>([\s\S]*?)<\/(?:trkpt|rtept)>)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const lat = parseFloat(m[1]);
    const lng = parseFloat(m[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
    let ele: number | null = null;
    if (m[3]) {
      const e = m[3].match(/<ele>([-\d.]+)<\/ele>/);
      if (e) {
        const ev = parseFloat(e[1]);
        if (Number.isFinite(ev)) ele = ev;
      }
    }
    points.push({ lat, lng, ele });
  }

  if (points.length < 2) {
    throw new Error("GPX sem trajeto utilizável (mínimo de 2 pontos válidos).");
  }

  let distanceMeters = 0;
  for (let i = 1; i < points.length; i++) {
    distanceMeters += haversineMeters(points[i - 1], points[i]);
  }

  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng); maxLng = Math.max(maxLng, p.lng);
  }

  const geojson: GeoJSON.LineString = {
    type: "LineString",
    coordinates: points.map((p) => [p.lng, p.lat]),
  };

  return {
    name,
    description,
    points,
    distanceMeters,
    start: { lat: points[0].lat, lng: points[0].lng },
    bounds: { minLat, maxLat, minLng, maxLng },
    geojson,
    hasElevation: points.some((p) => p.ele != null),
  };
}
