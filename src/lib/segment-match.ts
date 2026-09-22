// Detecção pura de esforço em segmento (spec segmentos).
// Não depende de React/Supabase. Reutiliza a fórmula de Haversine.
import { haversineMeters } from "@/lib/haversine";

export type MatchPoint = { lat: number; lng: number; ts: number };

export type SegmentGeo = {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  distanceMeters: number;
};

export type MatchOptions = {
  /** Raio de tolerância (m) para considerar que passou no início/fim. */
  radiusMeters?: number;
  /** Tolerância relativa da distância percorrida vs distância do segmento. */
  distanceTolerance?: number;
};

export type MatchResult = {
  matched: boolean;
  elapsedSeconds?: number;
  startIdx?: number;
  endIdx?: number;
};

const DEFAULT_RADIUS = 25;
const DEFAULT_DIST_TOL = 0.3;

function isFinitePoint(p: MatchPoint): boolean {
  return Number.isFinite(p.lat) && Number.isFinite(p.lng) && Number.isFinite(p.ts);
}

/** Índice do ponto mais próximo de `target` dentro de [from, points.length). */
export function nearestPointIndex(
  points: MatchPoint[],
  target: { lat: number; lng: number },
  from = 0,
): { idx: number; distance: number } {
  let bestIdx = -1;
  let bestDist = Infinity;
  for (let i = Math.max(0, from); i < points.length; i++) {
    const p = points[i];
    if (!isFinitePoint(p)) continue;
    const d = haversineMeters({ lat: p.lat, lng: p.lng }, target);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return { idx: bestIdx, distance: bestDist };
}

/** Distância percorrida ao longo do trajeto entre os índices [a, b]. */
function pathDistance(points: MatchPoint[], a: number, b: number): number {
  let total = 0;
  for (let i = a + 1; i <= b; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    if (!isFinitePoint(p0) || !isFinitePoint(p1)) continue;
    total += haversineMeters({ lat: p0.lat, lng: p0.lng }, { lat: p1.lat, lng: p1.lng });
  }
  return total;
}

/**
 * Verifica se o trajeto `points` percorreu o `segment`. Regra (Property 1):
 * acha o ponto mais próximo do início (dentro do raio); a partir dele, o ponto
 * mais próximo do fim (dentro do raio) com índice maior; valida que a distância
 * percorrida entre eles é compatível com a distância do segmento (tolerância).
 * O tempo (elapsed) é ts[end]-ts[start], sempre ≥ 0 (Property 2).
 */
export function matchSegmentEffort(
  points: MatchPoint[],
  segment: SegmentGeo,
  opts: MatchOptions = {},
): MatchResult {
  const radius = opts.radiusMeters ?? DEFAULT_RADIUS;
  const distTol = opts.distanceTolerance ?? DEFAULT_DIST_TOL;

  if (!Array.isArray(points) || points.length < 2) return { matched: false };

  // Ponto mais próximo do início.
  const start = nearestPointIndex(points, { lat: segment.startLat, lng: segment.startLng });
  if (start.idx < 0 || start.distance > radius) return { matched: false };

  // Ponto mais próximo do fim, APÓS o início (ordem).
  const end = nearestPointIndex(points, { lat: segment.endLat, lng: segment.endLng }, start.idx + 1);
  if (end.idx < 0 || end.distance > radius) return { matched: false };
  if (end.idx <= start.idx) return { matched: false };

  // Distância percorrida compatível com a do segmento (evita falso positivo).
  if (segment.distanceMeters > 0) {
    const traveled = pathDistance(points, start.idx, end.idx);
    const lo = segment.distanceMeters * (1 - distTol);
    const hi = segment.distanceMeters * (1 + distTol);
    if (traveled < lo || traveled > hi) return { matched: false };
  }

  const elapsed = (points[end.idx].ts - points[start.idx].ts) / 1000;
  if (!Number.isFinite(elapsed) || elapsed < 0) return { matched: false };

  return {
    matched: true,
    elapsedSeconds: Math.round(elapsed),
    startIdx: start.idx,
    endIdx: end.idx,
  };
}
