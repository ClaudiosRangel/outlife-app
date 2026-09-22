// Configuração de mapa (spec explorar-redesign). Decide o provider conforme a
// disponibilidade do token Mapbox. Puro/testável.

export function getMapboxToken(): string | null {
  const raw = (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined) ?? "";
  const token = raw.trim();
  return token.length > 0 ? token : null;
}

/** true quando há token Mapbox válido configurado (usar tiles Mapbox). */
export function hasMapbox(): boolean {
  return getMapboxToken() !== null;
}

/** Estilo de tiles raster do Mapbox usado no Leaflet (visual outdoor). */
export const MAPBOX_TILES_STYLE = "outdoors-v12";
