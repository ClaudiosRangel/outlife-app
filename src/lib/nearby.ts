// Filtro de proximidade para a camada "agora" do Explorar (spec
// explorar-redesign). Puro/testável. Usa Haversine para ordenar por distância.
import { haversineMeters } from "@/lib/haversine";

export type NowMarkerKind = "friend" | "partner" | "event";

export type NowMarker = {
  id: string;
  kind: NowMarkerKind;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  avatarUrl?: string | null;
  href?: string;
};

export type NearbyOptions = {
  /** Raio máximo em metros (default 150km). */
  radiusMeters?: number;
  /** Máximo de marcadores retornados (evita travar o mapa). */
  limit?: number;
};

const DEFAULT_RADIUS = 150_000;
const DEFAULT_LIMIT = 60;

function isFinitePoint(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng);
}

/**
 * Retorna os marcadores dentro do raio do centro, ordenados por distância,
 * limitados a `limit`. Amigos ao vivo têm prioridade (vêm primeiro dentro do
 * mesmo raio) por serem o destaque de "agora".
 */
export function filterNearby(
  markers: NowMarker[],
  center: { lat: number; lng: number } | null,
  opts: NearbyOptions = {},
): NowMarker[] {
  const radius = opts.radiusMeters ?? DEFAULT_RADIUS;
  const limit = Math.max(0, opts.limit ?? DEFAULT_LIMIT);

  const valid = markers.filter((m) => isFinitePoint(m.lat, m.lng));

  // Sem centro conhecido: retorna os primeiros (priorizando amigos), limitado.
  if (!center || !isFinitePoint(center.lat, center.lng)) {
    return prioritize(valid).slice(0, limit);
  }

  const withDist = valid
    .map((m) => ({
      m,
      d: haversineMeters({ lat: m.lat, lng: m.lng }, center),
    }))
    .filter((x) => x.d <= radius);

  withDist.sort((a, b) => {
    // Amigos primeiro; depois por distância.
    const pa = a.m.kind === "friend" ? 0 : 1;
    const pb = b.m.kind === "friend" ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return a.d - b.d;
  });

  return withDist.slice(0, limit).map((x) => x.m);
}

function prioritize(markers: NowMarker[]): NowMarker[] {
  return [...markers].sort((a, b) => {
    const pa = a.kind === "friend" ? 0 : 1;
    const pb = b.kind === "friend" ? 0 : 1;
    return pa - pb;
  });
}
