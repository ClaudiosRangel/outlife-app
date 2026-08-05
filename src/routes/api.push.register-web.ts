/**
 * Endpoint de registro de Web_Push_Subscription (task 12.5, Requirement 11.2).
 *
 * Chamado pelo cliente via `registerWebPushSubscription`
 * (`src/lib/push-registration.ts`) fora do Outlife_Native_Shell, com o
 * `PushSubscriptionJSON` retornado por `pushManager.subscribe`. Faz upsert
 * na tabela `web_push_subscriptions` (UNIQUE (user_id, endpoint)),
 * associado ao usuário autenticado via `requireSupabaseAuthFromRequest`.
 */
import { createFileRoute } from "@tanstack/react-router";

import { requireSupabaseAuthFromRequest, UnauthorizedRequestError } from "@/lib/require-supabase-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

type RegisterWebPushBody = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

export const Route = createFileRoute("/api/push/register-web")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request }) => {
        let user;
        try {
          user = await requireSupabaseAuthFromRequest(request);
        } catch (error) {
          if (error instanceof UnauthorizedRequestError) {
            return Response.json({ error: error.message }, { status: error.status, headers: CORS_HEADERS });
          }
          throw error;
        }

        const body = (await request.json()) as RegisterWebPushBody;
        if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
          return Response.json(
            { error: "Corpo inválido: endpoint, keys.p256dh e keys.auth são obrigatórios." },
            { status: 400, headers: CORS_HEADERS },
          );
        }

        const { error } = await supabaseAdmin
          .from("web_push_subscriptions" as never)
          .upsert(
            {
              user_id: user.id,
              endpoint: body.endpoint,
              p256dh: body.keys.p256dh,
              auth: body.keys.auth,
              is_active: true,
              updated_at: new Date().toISOString(),
            } as never,
            { onConflict: "user_id,endpoint" },
          );

        if (error) {
          return Response.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
        }

        return Response.json({ ok: true }, { headers: CORS_HEADERS });
      },
    },
  },
});
