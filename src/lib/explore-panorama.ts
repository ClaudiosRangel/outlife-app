// Panorama "agora na região" do Explorar (spec explorar-redesign, fase 2).
// Lógica pura/testável: contadores + destaques a partir dos dados já buscados.
import { haversineMeters } from "@/lib/haversine";

export type PanoramaFriend = { id: string; name: string; lat: number; lng: number; activityType?: string | null };
export type PanoramaPartner = { id: string; name: string; lat: number; lng: number };
export type PanoramaDestination = { id: string; name: string; lat: number; lng: number; rating: number };
export type PanoramaTrail = { id: string; name: string; lat: number; lng: number };
export type PanoramaEvent = { id: string; title: string; dateIso: string; lat?: number | null; lng?: number | null };

export type PanoramaInput = {
  center: { lat: number; lng: number } | null;
  friends: PanoramaFriend[];
  partners: PanoramaPartner[];
  destinations: PanoramaDestination[];
  trails: PanoramaTrail[];
  events: PanoramaEvent[];
  /** raio de proximidade em metros (default 150km). */
  radiusMeters?: number;
  nowMs?: number;
};

export type Panorama = {
  counts: {
    friendsLive: number;
    eventsUpcoming: number;
    partnersNearby: number;
    destinationsNearby: number;
    trailsNearby: number;
  };
  highlights: {
    nextEvent: PanoramaEvent | null;
    nearestFriend: (PanoramaFriend & { distanceKm: number }) | null;
    topDestination: PanoramaDestination | null;
  };
};

const DEFAULT_RADIUS = 150_000;

function near(center: { lat: number; lng: number } | null, lat: number, lng: number, radius: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (!center) return true; // sem centro, considera tudo (panorama nacional)
  return haversineMeters({ lat, lng }, center) <= radius;
}

export function buildPanorama(input: PanoramaInput): Panorama {
  const radius = input.radiusMeters ?? DEFAULT_RADIUS;
  const now = input.nowMs ?? Date.now();
  const center = input.center;

  const friendsNear = input.friends.filter((f) => near(center, f.lat, f.lng, radius));
  const partnersNear = input.partners.filter((p) => near(center, p.lat, p.lng, radius));
  const destinationsNear = input.destinations.filter((d) => near(center, d.lat, d.lng, radius));
  const trailsNear = input.trails.filter((t) => near(center, t.lat, t.lng, radius));

  // Eventos futuros (a partir de agora), ordenados por data. Eventos NÃO são
  // filtrados por proximidade: um evento pode não ter coordenadas (local é só
  // texto, ex.: "Lapa") e ainda assim é relevante mostrar que existe. Quando
  // há centro E o evento tem coords, damos preferência aos próximos, mas nunca
  // escondemos um evento futuro por falta de coordenada.
  const upcoming = input.events
    .filter((e) => {
      const t = Date.parse(e.dateIso);
      if (!Number.isFinite(t) || t < now) return false;
      // Se o evento tem coords e há centro, respeita o raio; sem coords, entra.
      if (center && e.lat != null && e.lng != null) {
        return near(center, e.lat, e.lng, radius);
      }
      return true;
    })
    .sort((a, b) => Date.parse(a.dateIso) - Date.parse(b.dateIso));

  // Amigo mais próximo (só com centro conhecido).
  let nearestFriend: (PanoramaFriend & { distanceKm: number }) | null = null;
  if (center) {
    let best = Infinity;
    for (const f of friendsNear) {
      const d = haversineMeters({ lat: f.lat, lng: f.lng }, center);
      if (d < best) {
        best = d;
        nearestFriend = { ...f, distanceKm: Math.round(d / 100) / 10 };
      }
    }
  } else if (friendsNear.length > 0) {
    nearestFriend = { ...friendsNear[0], distanceKm: 0 };
  }

  // Destino melhor avaliado por perto.
  const topDestination =
    destinationsNear.length > 0
      ? [...destinationsNear].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0]
      : null;

  return {
    counts: {
      friendsLive: friendsNear.length,
      eventsUpcoming: upcoming.length,
      partnersNearby: partnersNear.length,
      destinationsNearby: destinationsNear.length,
      trailsNearby: trailsNear.length,
    },
    highlights: {
      nextEvent: upcoming[0] ?? null,
      nearestFriend,
      topDestination,
    },
  };
}
