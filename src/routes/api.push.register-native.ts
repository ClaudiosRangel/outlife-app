/**
 * Endpoint de registro de Native_Push_Token (task 12.5, Requirement 11.1).
 *
 * Chamado pelo cliente via `registerNativePushToken` (`src/lib/push-registration.ts`)
 * quando a OutLife_Application roda dentro do Outlife_Native_Shell e o
 * usuário concede permissão de notificações nativas. Faz upsert na tabela
 * `native_push_tokens` (UNIQUE (user_id, device_id)), associado ao usuário
 * autenticado via `requireSupabaseAuthFromRequest` — nunca ao user_id
 * informado pelo corpo da requisição, para não permitir que um cliente
 * registre um token em nome de outro usuário.
 */
import { createFileRoute } from "@tanstack/react-router";

import { requireSupabaseAuthFromRequest, UnauthorizedRequestError } from "@/lib/require-supabase-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

type RegisterNativePushBody = {
  token?: string;
  platform?: string;
  deviceId?: string;
};

export const Route = createFileRoute("/api/push/register-native")({
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

        const body = (await request.json()) as RegisterNativePushBody;
        if (!body.token || !body.deviceId || (body.platform !== "android" && body.platform !== "ios")) {
          return Response.json(
            { error: "Corpo inválido: token, deviceId e platform (android|ios) são obrigatórios." },
            { status: 400, headers: CORS_HEADERS },
          );
        }

        const { error } = await supabaseAdmin
          .from("native_push_tokens" as never)
          .upsert(
            {
              user_id: user.id,
              token: body.token,
              platform: body.platform,
              device_id: body.deviceId,
              is_active: true,
              updated_at: new Date().toISOString(),
            } as never,
            { onConflict: "user_id,device_id" },
          );

        if (error) {
          return Response.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
        }

        return Response.json({ ok: true }, { headers: CORS_HEADERS });
      },
    },
  },
});
