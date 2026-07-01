/**
 * Stubs para integração futura com APIs externas (Google Places, Photos, etc).
 *
 * Estes tipos espelham o formato planejado para a UI ANTES da API real existir,
 * permitindo que componentes/queries já dependam de uma forma estável.
 *
 * As funções abaixo são intencionalmente vazias e devem ser implementadas
 * quando as chaves do Google Maps Platform estiverem disponíveis no projeto.
 */

export type GooglePlacesPhoto = {
  /** Identificador opaco fornecido pelo Google */
  reference: string;
  /** URL pronta para uso (ou null caso seja necessário resolver via /photo endpoint) */
  url: string | null;
  width: number;
  height: number;
  /** Atribuições obrigatórias para exibição (Google Places exige creditar) */
  attributions: string[];
};

export type GooglePlacesDestination = {
  /** place_id retornado pela API Google Places */
  placeId: string;
  name: string;
  /** Endereço formatado (formatted_address) */
  formattedAddress: string | null;
  latitude: number;
  longitude: number;
  /** Tipos do place (ex: tourist_attraction, park, natural_feature) */
  types: string[];
  /** Avaliação média 1-5, se disponível */
  rating: number | null;
  userRatingsTotal: number | null;
  /** Lista paginada de fotos (vazia quando não há) */
  photos: GooglePlacesPhoto[];
  /** Site oficial, se houver */
  website: string | null;
  /** Telefone internacional formatado */
  phone: string | null;
};

export type FetchDestinationsParams = {
  query?: string;
  /** Centro da busca: { lat, lng } */
  near?: { lat: number; lng: number };
  /** Raio em metros (default sugerido: 25_000) */
  radiusMeters?: number;
  /** Limite de resultados (default: 20) */
  limit?: number;
};

export type FetchPlacesPhotosParams = {
  placeId: string;
  /** Largura máxima desejada para cada foto (px) */
  maxWidth?: number;
  /** Quantidade máxima de fotos (default: 10) */
  limit?: number;
};

/**
 * Busca destinos turísticos no Google Places.
 * TODO: implementar via Edge Function/server-fn para proteger a chave da API.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function fetchDestinationsFromGoogle(
  _params: FetchDestinationsParams,
): Promise<GooglePlacesDestination[]> {
  return [];
}

/**
 * Busca fotos de um place específico no Google Places.
 * TODO: implementar via Edge Function/server-fn para proteger a chave da API.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function fetchPlacesPhotos(
  _params: FetchPlacesPhotosParams,
): Promise<GooglePlacesPhoto[]> {
  return [];
}
