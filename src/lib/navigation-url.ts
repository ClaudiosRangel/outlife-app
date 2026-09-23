// Monta a URL de navegação "me leve até lá" (item 4), abrindo o app de mapas
// nativo com rota turn-by-turn real. No WebView Android não há navegação
// turn-by-turn própria confiável; o padrão de mercado (e o mais robusto) é
// delegar ao Google Maps/Waze via URL universal. Puro/testável.

export interface LatLng {
  lat: number;
  lng: number;
}

/** true quando lat/lng são números finitos e dentro do intervalo geográfico. */
export function isValidLatLng(p: LatLng | null | undefined): p is LatLng {
  return (
    !!p &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    p.lat >= -90 &&
    p.lat <= 90 &&
    p.lng >= -180 &&
    p.lng <= 180
  );
}

/**
 * URL universal do Google Maps para navegar ATÉ `destination`, opcionalmente
 * partindo de `origin`. `travelmode` mapeia o tipo de atividade para o modo
 * de deslocamento (pedalada→bicycling, senão walking — é um app outdoor).
 * Retorna null se o destino for inválido.
 */
export function buildDirectionsUrl(
  destination: LatLng,
  opts?: { origin?: LatLng | null; activityType?: string | null },
): string | null {
  if (!isValidLatLng(destination)) return null;
  const params = new URLSearchParams();
  params.set("api", "1");
  params.set("destination", `${destination.lat},${destination.lng}`);
  if (opts?.origin && isValidLatLng(opts.origin)) {
    params.set("origin", `${opts.origin.lat},${opts.origin.lng}`);
  }
  params.set("travelmode", travelMode(opts?.activityType));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function travelMode(activityType?: string | null): "walking" | "bicycling" | "driving" {
  switch (activityType) {
    case "pedalada":
      return "bicycling";
    case "caminhada":
    case "corrida":
    case "trilha":
    case "escalada":
      return "walking";
    default:
      return "walking";
  }
}
