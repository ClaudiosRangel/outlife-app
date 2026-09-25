// Helpers puros para "Como chegar ao início" de uma rota/trilha/destino.
//
// Navegação turn-by-turn de CARRO não é viável dentro do WebView (nem faz
// sentido reimplementar) — o padrão de mercado (Strava/Komoot/AllTrails/Waze)
// é delegar ao app de mapas nativo. Aqui montamos a URL universal do Google
// Maps de DIREÇÕES até o ponto inicial, opcionalmente a partir da posição
// atual do usuário.

export type LatLng = { lat: number; lng: number };

/** Modo de deslocamento até o início da rota. */
export type TravelMode = "driving" | "walking" | "bicycling";

/**
 * URL de direções do Google Maps até `dest`. Se `origin` for informado, traça
 * a rota a partir dele; senão, o app de mapas usa a localização atual do
 * aparelho. `travelmode` default "driving" (como chegar de carro).
 */
export function buildDirectionsUrl(dest: LatLng, origin?: LatLng | null, travelmode: TravelMode = "driving"): string {
  const d = `${dest.lat},${dest.lng}`;
  const params = new URLSearchParams({ api: "1", destination: d, travelmode });
  if (origin) params.set("origin", `${origin.lat},${origin.lng}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** URL de "ver no mapa" (busca por coordenada) — sem rota. */
export function buildMapSearchUrl(dest: LatLng): string {
  return `https://www.google.com/maps/search/?api=1&query=${dest.lat},${dest.lng}`;
}

/**
 * Formata uma distância em metros de forma amigável: "850 m" (< 1 km),
 * "12,3 km" (< 100 km) ou "1.240 km" (>= 100 km, sem casas). Puro/testável.
 */
export function formatDistanceBR(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  if (km < 100) return `${km.toFixed(1).replace(".", ",")} km`;
  return `${Math.round(km).toLocaleString("pt-BR")} km`;
}
