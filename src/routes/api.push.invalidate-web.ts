/**
 * Endpoint de invalidação de Web_Push_Subscription (task 12.6, Requirement 11.8).
 *
 * Faz `UPDATE ... SET is_active = false` restrito ao usuário autenticado e
 * ao `endpoint` informado — nunca `DELETE`, preservando histórico para
 * auditoria. Chamado por `invalidatePushRegistration()`
 * (`src/lib/push-registration.ts`) no logout.
 */
import { createFileRoute } from "@tanstack/react-router";

import { requireSupabaseAuthFromRequest, UnauthorizedRequestError } from "@/lib/require-supabase-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

type InvalidateWebPushBody = {
  endpoint?: string;
};

export const Route = createFileRoute("/api/push/invalidate-web")({
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

        const body = (await request.json()) as InvalidateWebPushBody;
        if (!body.endpoint) {
          return Response.json({ error: "Corpo inválido: endpoint é obrigatório." }, { status: 400, headers: CORS_HEADERS });
        }

        const { error } = await supabaseAdmin
          .from("web_push_subscriptions" as never)
          .update({ is_active: false, updated_at: new Date().toISOString() } as never)
          .eq("user_id", user.id)
          .eq("endpoint", body.endpoint);

        if (error) {
          return Response.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
        }

        return Response.json({ ok: true }, { headers: CORS_HEADERS });
      },
    },
  },
});
