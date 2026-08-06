/**
 * Nitro API route para notificar admins por e-mail quando um destino é sugerido.
 * Acessível via POST /api/notify-admins
 */
import { defineEventHandler, readBody } from "h3";

const ADMIN_EMAILS = [
  "claudiosilvarangel1974@gmail.com",
  "caioestevesrangel14@gmail.com",
  "rafaelcv.166096@uniacademia.edu.br",
];

const FROM_EMAIL = "naoresponda@avidanaoesotrilhar.com.br";
const FROM_NAME = "OutLife";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const expectedSecret = process.env.PUSH_WEBHOOK_SECRET || "outlife-push-2026";

  if (body?.secret !== expectedSecret) {
    return { error: "Unauthorized" };
  }

  if (!body?.destinationName) {
    return { error: "destinationName obrigatório" };
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
  if (!RESEND_API_KEY) {
    return { error: "RESEND_API_KEY não configurada" };
  }

  const subject = `🏔️ Novo destino sugerido: ${body.destinationName}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1c3d2a;">Novo destino sugerido no OutLife</h2>
      <p>Um usuário sugeriu um novo destino para aprovação:</p>
      <div style="background: #f8faf9; border-radius: 12px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0 0 8px;"><strong>Destino:</strong> ${body.destinationName}</p>
        <p style="margin: 0 0 8px;"><strong>Sugerido por:</strong> ${body.suggestedBy || "Usuário"}</p>
        ${body.description ? `<p style="margin: 0;"><strong>Descrição:</strong> ${body.description.slice(0, 200)}${body.description.length > 200 ? "..." : ""}</p>` : ""}
      </div>
      <p>Acesse o painel de moderação para aprovar ou rejeitar:</p>
      <a href="https://outlife-app.vercel.app/admin/destinos"
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
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: ADMIN_EMAILS,
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { error: `Resend: ${response.status} ${errorText}` };
    }

    return { ok: true };
  } catch (err: any) {
    return { error: err.message || "Erro ao enviar e-mail" };
  }
});
