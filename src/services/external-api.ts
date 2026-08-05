/**
 * Camada de acesso ao Google Places, com seletor de transporte entre
 * SSR_Build_Target e SPA_Build_Target (Requirements 1.6, 1.7, 12.5).
 *
 * `fetchDestinationsFromGoogle`/`fetchPlacesPhotos` são o único ponto de
 * chamada usado pela UI. Quando `import.meta.env.VITE_BUILD_TARGET ===
 * "native"` (build empacotada no Outlife_Native_Shell, sem server functions
 * em tempo de execução), a chamada é feita via `fetch()` HTTP contra o
 * endpoint remoto equivalente exposto pelo SSR_Build_Target
 * (`VITE_API_BASE_URL` + `/api/places/search` ou `/api/places/photos`),
 * usando `fetchWithTimeoutAndFallback` (timeout de 10s, nunca lança —
 * Requirement 12.5). Caso contrário, mantém a chamada local já existente à
 * server function do TanStack Start. A assinatura pública e o formato de
 * retorno das duas funções não mudam — só a estratégia de transporte.
 */
import { supabase } from '@/integrations/supabase/client';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
const PLACES_PROXY_TIMEOUT_MS = 10_000;

/**
 * Lê o access token da sessão Supabase atual, para autenticar a chamada ao
 * endpoint remoto do proxy do Google Places (Requirement 12.4). Nunca lança:
 * qualquer falha ao obter a sessão resolve com `null`, e a chamada HTTP
 * segue sem o cabeçalho `Authorization` (o endpoint remoto rejeita com 401
 * nesse caso, tratado como falha comum por `fetchWithTimeoutAndFallback`).
 */
async function getSupabaseAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Helper de transporte HTTP para o SPA_Build_Target/Outlife_Native_Shell.
 *
 * Faz um `POST` com timeout de `timeoutMs` (default 10s), autenticado com o
 * token da sessão Supabase atual quando disponível. NUNCA lança exceção:
 * timeout, erro de rede, erro HTTP (resposta não-2xx) ou falha ao interpretar
 * o corpo da resposta resolvem todos com `fallback` (Requirement 12.5,
 * Property 32).
 */
export async function fetchWithTimeoutAndFallback<T>(
  url: string,
  body: unknown,
  fallback: T,
  timeoutMs: number = PLACES_PROXY_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const token = await getSupabaseAccessToken();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      return fallback;
    }
    return (await response.json()) as T;
  } catch {
    return fallback;
  } finally {
    clearTimeout(timeoutId);
  }
}

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
 *
 * No SPA_Build_Target (`VITE_BUILD_TARGET === "native"`), chama via HTTP o
 * endpoint remoto `${VITE_API_BASE_URL}/api/places/search` exposto pelo
 * SSR_Build_Target (Requirement 1.6, 12.1), resolvendo com `[]` em caso de
 * falha ou timeout (Requirement 1.7, 12.5) — nunca lança.
 *
 * No SSR_Build_Target (comportamento default, inalterado), delega para a
 * TanStack Start server function `fetchDestinationsFromGooglePlaces`
 * (src/services/places.server.ts), que é a única camada que lê o
 * Google_Places_Credential (`GOOGLE_PLACES_API_KEY`), nunca exposto ao
 * bundle do cliente. Assinatura pública preservada em ambos os casos.
 */
export async function fetchDestinationsFromGoogle(
  params: FetchDestinationsParams,
): Promise<GooglePlacesDestination[]> {
  if (import.meta.env.VITE_BUILD_TARGET === 'native') {
    return fetchWithTimeoutAndFallback<GooglePlacesDestination[]>(
      `${API_BASE_URL}/api/places/search`,
      params,
      [],
    );
  }
  const { fetchDestinationsFromGooglePlaces } = await import('./places.server');
  return fetchDestinationsFromGooglePlaces({ data: params });
}

/**
 * Busca fotos de um place específico no Google Places.
 *
 * No SPA_Build_Target (`VITE_BUILD_TARGET === "native"`), chama via HTTP o
 * endpoint remoto `${VITE_API_BASE_URL}/api/places/photos` exposto pelo
 * SSR_Build_Target, com o mesmo comportamento de resiliência descrito em
 * `fetchDestinationsFromGoogle` acima.
 *
 * No SSR_Build_Target, delega para a TanStack Start server function
 * `fetchPlacesPhotosFromGooglePlaces` (src/services/places.server.ts), pelo
 * mesmo motivo acima.
 */
export async function fetchPlacesPhotos(
  params: FetchPlacesPhotosParams,
): Promise<GooglePlacesPhoto[]> {
  if (import.meta.env.VITE_BUILD_TARGET === 'native') {
    return fetchWithTimeoutAndFallback<GooglePlacesPhoto[]>(
      `${API_BASE_URL}/api/places/photos`,
      params,
      [],
    );
  }
  const { fetchPlacesPhotosFromGooglePlaces } = await import('./places.server');
  return fetchPlacesPhotosFromGooglePlaces({ data: params });
}
