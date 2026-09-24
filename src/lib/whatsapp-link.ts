// Helpers puros para montar links do WhatsApp (convite/lembrete de evento e
// contato). O WhatsApp abre via URL universal `https://wa.me/...`:
//  - com número:  https://wa.me/<E164sem+>?text=<msg>
//  - sem número:  https://wa.me/?text=<msg>  (usuário escolhe o contato)
// Puro/testável.

/** Normaliza um telefone BR para E.164 sem '+', ex.: "(32) 99999-0000" -> "5532999990000". */
export function normalizePhoneBR(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  // Já tem DDI 55.
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return digits;
  // 10 (fixo) ou 11 (celular) dígitos -> prefixa 55.
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export interface EventInviteInput {
  title: string;
  dateIso?: string | null;
  meetingPoint?: string | null;
  city?: string | null;
  /** Link para o evento no app (deep link/URL), opcional. */
  url?: string | null;
  /** true = mensagem de lembrete; false = convite. */
  reminder?: boolean;
}

function fmtDate(dateIso?: string | null): string | null {
  if (!dateIso) return null;
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/** Monta a mensagem de convite/lembrete de um evento (texto puro). */
export function buildEventMessage(input: EventInviteInput): string {
  const lines: string[] = [];
  const head = input.reminder
    ? `⏰ Lembrete: *${input.title}*`
    : `🏕️ Bora nessa? Te convido para *${input.title}* no OutVitar!`;
  lines.push(head);
  const date = fmtDate(input.dateIso);
  if (date) lines.push(`📅 ${date}`);
  const local = [input.meetingPoint, input.city].filter(Boolean).join(" · ");
  if (local) lines.push(`📍 ${local}`);
  if (input.url) lines.push(`\n${input.url}`);
  return lines.join("\n");
}

/**
 * Monta a URL do WhatsApp. Se `phone` for válido, abre a conversa com esse
 * contato; senão abre o seletor de contatos com a mensagem pronta.
 */
export function buildWhatsAppUrl(message: string, phone?: string | null): string {
  const text = encodeURIComponent(message);
  const num = normalizePhoneBR(phone);
  return num ? `https://wa.me/${num}?text=${text}` : `https://wa.me/?text=${text}`;
}

/** Conveniência: link de convite/lembrete de evento (sem número = escolher contato). */
export function buildEventInviteUrl(input: EventInviteInput, phone?: string | null): string {
  return buildWhatsAppUrl(buildEventMessage(input), phone);
}
