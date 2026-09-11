/**
 * Endpoint server-side para enviar push notifications via FCM API V1.
 * Server-only: os handlers só executam no contexto do servidor (Vercel/Nitro).
 * No SPA_Build_Target, este módulo é importado pelo routeTree mas nunca executado.
 */
import { createFileRoute } from "@tanstack/react-router";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/** Carrega a service account sob demanda (apenas no servidor).
 * Prioridade: env var FIREBASE_SERVICE_ACCOUNT (JSON stringificado) → arquivo local (dev). */
async function loadServiceAccount() {
  try {
    // Produção (Vercel): env var com o JSON inteiro
    const envSa = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (envSa) {
      return JSON.parse(envSa) as { project_id: string; client_email: string; private_key: string };
    }
    // Dev local: arquivo na raiz do projeto
    const fs = await import("node:fs");
    const path = await import("node:path");
    const saPath = path.resolve(process.cwd(), "firebase-service-account.json");
    const raw = fs.readFileSync(saPath, "utf-8");
    return JSON.parse(raw) as { project_id: string; client_email: string; private_key: string };
  } catch {
    return null;
  }
}

/** Gera access token OAuth2 para FCM API V1 */
async function getFcmAccessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const { SignJWT, importPKCS8 } = await import("jose");
  const privateKey = await importPKCS8(sa.private_key, "RS256");
  const jwt = await new SignJWT({ scope: "https://www.googleapis.com/auth/firebase.messaging" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(sa.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  if (!response.ok) throw new Error(`OAuth2 error: ${response.status}`);
  const data = await response.json();
  return data.access_token;
}

/** Envia push via FCM API V1 (inclui o badge do ícone quando informado). */
async function sendFcmPush(
  sa: { project_id: string; client_email: string; private_key: string },
  token: string,
  title: string,
  body: string,
  badge?: number,
): Promise<void> {
  const accessToken = await getFcmAccessToken(sa);
  const count = Number.isFinite(badge) && (badge as number) >= 0 ? Math.floor(badge as number) : undefined;
  // Tag única por envio: no Android, o badge do launcher deriva do número de
  // notificações ATIVAS na bandeja. Se todas compartilham a mesma tag, uma
  // substitui a outra (bandeja fica com 1 → badge 1). Uma tag distinta por
  // push faz cada notificação acumular, e o badge acompanha a contagem.
  const uniqueTag = `outvitar-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        android: {
          priority: "high",
          notification: {
            // Cada push é uma notificação distinta na bandeja (badge cresce).
            tag: uniqueTag,
            notification_priority: "PRIORITY_HIGH",
            // Reforço do contador (alguns launchers/OEMs respeitam).
            ...(count !== undefined ? { notification_count: count } : {}),
          },
        },
        // iOS (APNs): badge do ícone definido diretamente pelo número.
        ...(count !== undefined ? { apns: { payload: { aps: { badge: count } } } } : {}),
      },
    }),
  });
  if (!response.ok) throw new Error(`FCM error: ${response.status} ${await response.text()}`);
}

function getNotificationContent(type: string): { title: string; body: string } {
  switch (type) {
    case "friend_request": return { title: "OutVitar", body: "Você recebeu uma solicitação de amizade!" };
    case "post_like": return { title: "OutVitar", body: "Alguém curtiu sua publicação!" };
    case "activity_completed": return { title: "OutVitar", body: "Um amigo concluiu uma atividade!" };
    case "partner_lead": return { title: "OutVitar", body: "Alguém demonstrou interesse no seu perfil!" };
    case "review_received": return { title: "OutVitar", body: "Você recebeu uma nova avaliação!" };
    default: return { title: "OutVitar", body: "Você tem uma nova notificação" };
  }
}

type SendFcmBody = { token: string; type: string; secret?: string; badge?: number };

export const Route = createFileRoute("/api/push/send-fcm")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request }) => {
        const body = (await request.json()) as SendFcmBody;
        const expectedSecret = process.env.PUSH_WEBHOOK_SECRET || "outlife-push-2026";
        if (body.secret !== expectedSecret) {
          return Response.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
        }
        if (!body.token || !body.type) {
          return Response.json({ error: "token e type obrigatórios" }, { status: 400, headers: CORS_HEADERS });
        }
        const sa = await loadServiceAccount();
        if (!sa) {
          return Response.json({ error: "FCM não configurado" }, { status: 503, headers: CORS_HEADERS });
        }
        try {
          const { title, body: notifBody } = getNotificationContent(body.type);
          await sendFcmPush(sa, body.token, title, notifBody, body.badge);
          return Response.json({ ok: true }, { headers: CORS_HEADERS });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return Response.json({ error: message }, { status: 500, headers: CORS_HEADERS });
        }
      },
    },
  },
});
