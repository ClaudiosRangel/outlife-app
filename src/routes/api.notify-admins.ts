/**
 * Endpoint server-side para notificar os admins por e-mail quando um
 * destino é sugerido (status: pending). Chamado via pg_net pelo trigger
 * no Supabase, ou diretamente pelo client após createPendingDestination.
 */
import { createFileRoute } from "@tanstack/react-router";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// E-mails dos responsáveis (mesmos da tabela admin_emails no banco)
const ADMIN_EMAILS = [
  "claudiosilvarangel1974@gmail.com",
  "caioestevesrangel14@gmail.com",
  "rafaelcv.166096@uniacademia.edu.br",
];

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const FROM_EMAIL = "naoresponda@avidanaoesotrilhar.com.br";
const FROM_NAME = "OutLife";

type NotifyBody = {
  destinationName: string;
  suggestedBy: string;
  description?: string;
  secret?: string;
};

async function sendEmailViaResend(to: string[], subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn("[notify-admins] RESEND_API_KEY não configurada — e-mail não enviado");
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend error: ${response.status} ${errorText}`);
  }
}

export const Route = createFileRoute("/api/notify-admins")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request }) => {
        const body = (await request.json()) as NotifyBody;

        const expectedSecret = process.env.PUSH_WEBHOOK_SECRET || "outlife-push-2026";
        if (body.secret !== expectedSecret) {
          return Response.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
        }

        if (!body.destinationName) {
          return Response.json({ error: "destinationName obrigatório" }, { status: 400, headers: CORS_HEADERS });
        }

        const subject = `🏔️ Novo destino sugerido: ${body.destinationName}`;
        const html = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1c3d2a;">Novo destino sugerido no OutLife</h2>
            <p>Um usuário sugeriu um novo destino para aprovação:</p>
            <div style="background: #f8faf9; border-radius: 12px; padding: 16px; margin: 16px 0;">
              <p style="margin: 0 0 8px;"><strong>Destino:</strong> ${body.destinationName}</p>
              <p style="margin: 0 0 8px;"><strong>Sugerido por:</strong> ${body.suggestedBy || "Usuário anônimo"}</p>
              ${body.description ? `<p style="margin: 0;"><strong>Descrição:</strong> ${body.description.slice(0, 200)}${body.description.length > 200 ? "..." : ""}</p>` : ""}
            </div>
            <p>Acesse o painel de moderação para aprovar ou rejeitar:</p>
            <a href="https://outlife-app.vercel.app/admin/compliance" 
               style="display: inline-block; background: #1c3d2a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Revisar destino
            </a>
            <p style="margin-top: 24px; font-size: 12px; color: #666;">
              OutLife — A vida não é só trilhar<br>
              Este e-mail foi enviado automaticamente.
            </p>
          </div>
        `;

        try {
          await sendEmailViaResend(ADMIN_EMAILS, subject, html);
          return Response.json({ ok: true }, { headers: CORS_HEADERS });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[notify-admins]", message);
          return Response.json({ error: message }, { status: 500, headers: CORS_HEADERS });
        }
      },
    },
  },
});
