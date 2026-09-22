// Configuração de mapa (spec explorar-redesign). Decide o provider conforme a
// disponibilidade do token Mapbox. Puro/testável.

export function getMapboxToken(): string | null {
  const raw = (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined) ?? "";
  const token = raw.trim();
  return token.length > 0 ? token : null;
}

/** true quando há token Mapbox válido configurado (usar Mapbox GL). */
export function hasMapbox(): boolean {
  return getMapboxToken() !== null;
}

/** Estilo padrão do mapa (outdoor, combina com o app). */
export const MAPBOX_STYLE = "mapbox://styles/mapbox/outdoors-v12";

/** Centro/zoom padrão (Brasil). */
export const BRAZIL_CENTER: [number, number] = [-47.9292, -15.7801]; // [lng, lat]
export const BRAZIL_ZOOM = 3.5;
