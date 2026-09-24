// Busca a rota REAL seguindo as ruas entre pontos, via Mapbox Directions API,
// para o segmento ter as curvas do caminho (não uma reta). Item 1.
//
// Perfil por tipo de atividade: pedalada -> cycling; a pé (caminhada/corrida/
// trilha) -> walking; senão walking. Retorna a geometria como [lng,lat][].
// Best-effort: em qualquer falha, retorna null e o chamador usa o fallback
// (reta ligando os pontos).

import { getMapboxToken } from "@/lib/map-config";

export type LngLat = [number, number]; // [lng, lat]

function profileFor(activityType?: string | null): "walking" | "cycling" | "driving" {
  switch (activityType) {
    case "pedalada":
      return "cycling";
    case "caminhada":
    case "corrida":
    case "trilha":
    case "escalada":
      return "walking";
    default:
      return "walking";
  }
}

/**
 * Rota seguindo as ruas entre `start` e `end` (opcionalmente com waypoints no
 * meio, máx. 25 no total pela API). Retorna a polilinha [lng,lat][] ou null.
 */
export async function fetchRouteAlongRoads(
  start: LngLat,
  end: LngLat,
  opts?: { activityType?: string | null; waypoints?: LngLat[] },
): Promise<LngLat[] | null> {
  const token = getMapboxToken();
  if (!token) return null;
  const profile = profileFor(opts?.activityType);
  const coords = [start, ...(opts?.waypoints ?? []), end]
    .slice(0, 25)
    .map(([lng, lat]) => `${lng},${lat}`)
    .join(";");
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}` +
    `?geometries=geojson&overview=full&access_token=${token}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const line = data?.routes?.[0]?.geometry?.coordinates as LngLat[] | undefined;
    if (Array.isArray(line) && line.length >= 2) return line;
    return null;
  } catch {
    return null;
  }
}
