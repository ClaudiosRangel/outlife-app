// Distância em metros entre duas coordenadas WGS84 (fórmula de Haversine).
export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000; // raio médio da Terra em metros
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Frente G (Req 3): true quando `point` está a até `radiusMeters` de `dest`
// (inclusive). Base para o registro de visita a Destino via GPS. Coordenadas
// não-finitas ou raio inválido → false (nunca lança nem retorna NaN).
export function isWithinRadius(
  point: { lat: number; lng: number },
  dest: { lat: number; lng: number },
  radiusMeters: number,
): boolean {
  if (
    !Number.isFinite(point.lat) ||
    !Number.isFinite(point.lng) ||
    !Number.isFinite(dest.lat) ||
    !Number.isFinite(dest.lng) ||
    !Number.isFinite(radiusMeters) ||
    radiusMeters < 0
  ) {
    return false;
  }
  return haversineMeters(point, dest) <= radiusMeters;
}
