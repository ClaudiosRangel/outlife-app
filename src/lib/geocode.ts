// Geocodificação de texto → coordenadas via Mapbox Geocoding (usa o token que
// já temos). Para a busca por cidade/lugar no Explorar (spec fase 3).
import { getMapboxToken } from "@/lib/map-config";

export type GeocodeResult = {
  name: string;
  lat: number;
  lng: number;
};

/**
 * Geocodifica um texto (ex.: "Juiz de Fora") no Brasil. Retorna o melhor
 * resultado ou null. Sem token, retorna null (a busca simplesmente não
 * recentraliza). Best-effort — erros viram null.
 */
export async function geocodePlace(query: string): Promise<GeocodeResult | null> {
  const q = query.trim();
  if (q.length < 2) return null;
  const token = getMapboxToken();
  if (!token) return null;
  try {
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json` +
      `?access_token=${token}&country=br&language=pt&limit=1&types=place,locality,region,poi`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const j = (await res.json()) as {
      features?: { place_name?: string; text?: string; center?: [number, number] }[];
    };
    const f = j.features?.[0];
    if (!f?.center) return null;
    return {
      name: f.text ?? f.place_name ?? q,
      lat: f.center[1],
      lng: f.center[0],
    };
  } catch {
    return null;
  }
}
