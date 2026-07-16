/**
 * Google_Places_Integration — implementação real via TanStack Start server
 * functions (Requirement 6).
 *
 * O Google_Places_Credential (`GOOGLE_PLACES_API_KEY`) é lida exclusivamente
 * aqui, do lado servidor (`process.env`, sem prefixo `VITE_`), nunca incluída
 * no bundle enviado ao cliente. `src/services/external-api.ts` delega para
 * as funções abaixo, preservando a assinatura pública já usada pela UI.
 *
 * Contrato de resiliência (Requirements 6.4, 6.5): ambas as funções NUNCA
 * lançam exceção. Qualquer falha (credencial ausente, erro de rede, erro
 * HTTP da API, ou falha no próprio registro de diagnóstico) resolve com um
 * array vazio. Quando a credencial está ausente/não resolvível, nenhuma
 * chamada de rede é executada.
 */
import { createServerFn } from '@tanstack/react-start';
import type {
  FetchDestinationsParams,
  FetchPlacesPhotosParams,
  GooglePlacesDestination,
  GooglePlacesPhoto,
} from './external-api';

const PLACES_API_BASE = 'https://places.googleapis.com/v1';

function getGooglePlacesApiKey(): string | null {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  return key && key.trim().length > 0 ? key : null;
}

/** Registro de erro como melhor esforço — uma falha aqui nunca deve impedir o retorno de `[]`. */
function logPlacesError(context: string, error: unknown): void {
  try {
    console.error(`[Google_Places_Integration] ${context}:`, error);
  } catch {
    // Falha no próprio logging é ignorada silenciosamente (Requirement 6.5).
  }
}

type GooglePlaceResult = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  types?: string[];
  rating?: number;
  userRatingCount?: number;
  photos?: { name?: string; widthPx?: number; heightPx?: number; authorAttributions?: { displayName?: string }[] }[];
  websiteUri?: string;
  internationalPhoneNumber?: string;
};

function mapPlaceToDestination(place: GooglePlaceResult): GooglePlacesDestination {
  return {
    placeId: place.id ?? '',
    name: place.displayName?.text ?? '',
    formattedAddress: place.formattedAddress ?? null,
    latitude: place.location?.latitude ?? 0,
    longitude: place.location?.longitude ?? 0,
    types: place.types ?? [],
    rating: place.rating ?? null,
    userRatingsTotal: place.userRatingCount ?? null,
    photos: (place.photos ?? []).map((p) => ({
      reference: p.name ?? '',
      url: null,
      width: p.widthPx ?? 0,
      height: p.heightPx ?? 0,
      attributions: (p.authorAttributions ?? [])
        .map((a) => a.displayName)
        .filter((n): n is string => Boolean(n)),
    })),
    website: place.websiteUri ?? null,
    phone: place.internationalPhoneNumber ?? null,
  };
}

/**
 * Lógica pura do handler de `fetchDestinationsFromGooglePlaces`, extraída do
 * wrapper `createServerFn` para ser testável diretamente em ambiente de
 * teste (vitest), já que `createServerFn` exige o runtime do TanStack Start
 * (AsyncLocalStorage) para ser invocado. O comportamento de produção é
 * idêntico: `createServerFn(...).handler(...)` abaixo apenas delega para
 * esta função.
 */
export async function fetchDestinationsHandler(
  params: FetchDestinationsParams,
): Promise<GooglePlacesDestination[]> {
  const apiKey = getGooglePlacesApiKey();
  if (!apiKey) {
    return [];
  }

  try {
    const body: Record<string, unknown> = {
      textQuery: params.query ?? 'trilha OR cachoeira OR parque nacional',
      maxResultCount: Math.min(params.limit ?? 20, 20),
    };
    if (params.near) {
      body.locationBias = {
        circle: {
          center: { latitude: params.near.lat, longitude: params.near.lng },
          radius: params.radiusMeters ?? 25_000,
        },
      };
    }

    const response = await fetch(`${PLACES_API_BASE}/places:searchText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.userRatingCount,places.photos,places.websiteUri,places.internationalPhoneNumber',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      logPlacesError(
        `fetchDestinationsFromGooglePlaces respondeu HTTP ${response.status}`,
        await response.text().catch(() => '<sem corpo>'),
      );
      return [];
    }

    const json = (await response.json()) as { places?: GooglePlaceResult[] };
    return (json.places ?? []).map(mapPlaceToDestination);
  } catch (error) {
    logPlacesError('falha ao buscar destinos', error);
    return [];
  }
}

export const fetchDestinationsFromGooglePlaces = createServerFn({ method: 'GET' })
  .validator((params: FetchDestinationsParams) => params)
  .handler(async ({ data: params }): Promise<GooglePlacesDestination[]> => fetchDestinationsHandler(params));

/**
 * Lógica pura do handler de `fetchPlacesPhotosFromGooglePlaces`, extraída do
 * wrapper `createServerFn` pelo mesmo motivo documentado em
 * `fetchDestinationsHandler` acima.
 */
export async function fetchPlacesPhotosHandler(
  params: FetchPlacesPhotosParams,
): Promise<GooglePlacesPhoto[]> {
  const apiKey = getGooglePlacesApiKey();
  if (!apiKey) {
    return [];
  }

  try {
    const response = await fetch(
      `${PLACES_API_BASE}/places/${encodeURIComponent(params.placeId)}?fields=photos`,
      {
        headers: { 'X-Goog-Api-Key': apiKey },
      },
    );

    if (!response.ok) {
      logPlacesError(
        `fetchPlacesPhotosFromGooglePlaces respondeu HTTP ${response.status}`,
        await response.text().catch(() => '<sem corpo>'),
      );
      return [];
    }

    const json = (await response.json()) as {
      photos?: {
        name?: string;
        widthPx?: number;
        heightPx?: number;
        authorAttributions?: { displayName?: string }[];
      }[];
    };
    const limit = params.limit ?? 10;
    return (json.photos ?? []).slice(0, limit).map((p) => ({
      reference: p.name ?? '',
      // A URL de mídia real do Google Places exige a API key como query
      // param (`?key=...`). NUNCA construímos essa URL aqui com a chave
      // embutida — isso exporia o Google_Places_Credential diretamente ao
      // cliente (Requirement 6.1). Retornamos `null`; resolver os bytes
      // reais da foto exigiria um endpoint de proxy server-side dedicado
      // (fora do escopo desta task), que buscaria a imagem no servidor e
      // a repassaria ao cliente sem nunca expor a chave.
      url: null,
      width: p.widthPx ?? 0,
      height: p.heightPx ?? 0,
      attributions: (p.authorAttributions ?? [])
        .map((a) => a.displayName)
        .filter((n): n is string => Boolean(n)),
    }));
  } catch (error) {
    logPlacesError('falha ao buscar fotos', error);
    return [];
  }
}

export const fetchPlacesPhotosFromGooglePlaces = createServerFn({ method: 'GET' })
  .validator((params: FetchPlacesPhotosParams) => params)
  .handler(async ({ data: params }): Promise<GooglePlacesPhoto[]> => fetchPlacesPhotosHandler(params));
