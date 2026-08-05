/**
 * Proxy remoto do Google Places — busca de destinos (task 13.2).
 *
 * TanStack Start API route (`server.handlers`) consumida pelo
 * SPA_Build_Target/Outlife_Native_Shell via `fetchWithTimeoutAndFallback`
 * (`src/services/external-api.ts`), que não tem acesso a server functions em
 * tempo de execução (Requirement 12.1).
 *
 * - Autenticação: `requireSupabaseAuthFromRequest` valida o header
 *   `Authorization: Bearer <supabase access token>`; ausência/invalidez
 *   resulta em HTTP 401 sem executar a busca no Google Places
 *   (Requirement 12.4).
 * - Lógica de busca: delega para `fetchDestinationsHandler`
 *   (`src/services/places.server.ts`), a mesma função reutilizada pela
 *   server function local — preserva a proteção da Google_Places_Credential,
 *   nunca exposta a este endpoint nem ao cliente (Requirement 12.2).
 * - CORS: cabeçalhos permissivos o bastante para aceitar chamadas do
 *   Outlife_Native_Shell mesmo quando a origem de rede difere da origem do
 *   SSR_Build_Target (Requirement 12.3). Como a autenticação aqui é via
 *   Bearer token (não cookie), CORS `*` não expõe sessão nenhuma.
 * - Timeout interno de 10s: se `fetchDestinationsHandler` não resolver a
 *   tempo, respondemos com `[]` (mesmo contrato de resiliência do cliente em
 *   `fetchWithTimeoutAndFallback`, Requirement 12.5) em vez de deixar a
 *   requisição pendente indefinidamente.
 */
import { createFileRoute } from "@tanstack/react-router";

import { requireSupabaseAuthFromRequest, UnauthorizedRequestError } from "@/lib/require-supabase-auth";
import { fetchDestinationsHandler } from "@/services/places.server";
import type { FetchDestinationsParams, GooglePlacesDestination } from "@/services/external-api";

const SEARCH_TIMEOUT_MS = 10_000;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * Executa `fetchDestinationsHandler` com um timeout local de 10s. Como
 * `fetchDestinationsHandler` já nunca lança (resolve `[]` em qualquer falha
 * interna), o único caso adicional tratado aqui é o de a chamada de rede ao
 * Google Places simplesmente não retornar a tempo — nesse caso resolvemos
 * com `[]`, mesmo fallback usado pelo cliente nativo.
 */
async function fetchDestinationsWithTimeout(
  params: FetchDestinationsParams,
): Promise<GooglePlacesDestination[]> {
  return new Promise((resolve) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve([]);
      }
    }, SEARCH_TIMEOUT_MS);

    fetchDestinationsHandler(params)
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

export const Route = createFileRoute("/api/places/search")({
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

        const body = (await request.json()) as FetchDestinationsParams;
        const result = await fetchDestinationsWithTimeout(body);
        return Response.json(result, { headers: CORS_HEADERS });
      },
    },
  },
});
