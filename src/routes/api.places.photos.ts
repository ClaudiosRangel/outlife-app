/**
 * Proxy remoto do Google Places — busca de fotos de um place (task 13.2).
 *
 * Ver `src/routes/api.places.search.ts` para o racional completo (auth via
 * `requireSupabaseAuthFromRequest`, CORS, timeout de 10s). Este endpoint
 * delega para `fetchPlacesPhotosHandler` em vez de `fetchDestinationsHandler`
 * (Requirements 12.1, 12.2, 12.3).
 */
import { createFileRoute } from "@tanstack/react-router";

import { requireSupabaseAuthFromRequest, UnauthorizedRequestError } from "@/lib/require-supabase-auth";
import { fetchPlacesPhotosHandler } from "@/services/places.server";
import type { FetchPlacesPhotosParams, GooglePlacesPhoto } from "@/services/external-api";

const PHOTOS_TIMEOUT_MS = 10_000;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * Executa `fetchPlacesPhotosHandler` com um timeout local de 10s, resolvendo
 * com `[]` se a chamada não retornar a tempo (mesmo fallback usado pelo
 * cliente nativo em `fetchWithTimeoutAndFallback`).
 */
async function fetchPlacesPhotosWithTimeout(
  params: FetchPlacesPhotosParams,
): Promise<GooglePlacesPhoto[]> {
  return new Promise((resolve) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve([]);
      }
    }, PHOTOS_TIMEOUT_MS);

    fetchPlacesPhotosHandler(params)
      .then((result) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeoutId);
          resolve(result);
        }
      })
      .catch(() => {
        if (!settled) {
          settled = true;
          clearTimeout(timeoutId);
          resolve([]);
        }
      });
  });
}

export const Route = createFileRoute("/api/places/photos")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request }) => {
        try {
          await requireSupabaseAuthFromRequest(request);
        } catch (error) {
          if (error instanceof UnauthorizedRequestError) {
            return Response.json({ error: error.message }, { status: error.status, headers: CORS_HEADERS });
          }
          throw error;
        }

        const body = (await request.json()) as FetchPlacesPhotosParams;
        const result = await fetchPlacesPhotosWithTimeout(body);
        return Response.json(result, { headers: CORS_HEADERS });
      },
    },
  },
});
