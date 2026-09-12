// Cálculo puro do status do Partner_Trial baseado em DATA (1 ano).
//
// Requirement 6 (spec evolucao-admin-atividades-social): o trial do parceiro
// passa a durar 1 ano a partir de uma data de início (antes era por cliques,
// PARTNER_TRIAL_CLICK_THRESHOLD=15). Esta é a única fonte de verdade da
// fórmula, reaproveitada pela API (`fetchPartnerTrialStatus`) e testável sem
// nenhum acesso a rede/DOM.

/** Duração do Partner_Trial, em dias (Requirement 6.1). */
export const TRIAL_DURATION_DAYS = 365;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface TrialStatus {
  /** true enquanto a data atual está dentro da janela de 1 ano (Req 6.2/6.3). */
  trialActive: boolean;
  /** dias restantes do trial; 0 quando expirado ou entrada inválida (Req 6.4). */
  remainingDays: number;
  /** ISO da data de início efetiva usada no cálculo. */
  startedAt: string;
  /** ISO do fim do trial (startedAt + 365 dias); string vazia se entrada inválida. */
  endsAt: string;
  /** fração [0,1] do tempo já decorrido no ano (para a barra de progresso). */
  elapsedFraction: number;
}

/**
 * Calcula o status do trial a partir da data de início (ISO) e do "agora"
 * (epoch ms). Função pura: nunca lê estado externo, nunca lança, nunca
 * retorna `NaN`/`Infinity`.
 *
 * - `endsAt = startedAt + 365 dias`.
 * - `trialActive = now < endsAt`.
 * - `remainingDays = max(0, ceil((endsAt - now) / dia))`.
 * - Entrada inválida (data não-parseável) → trial inativo, 0 dias, campos
 *   vazios/zerados (Property 1 do design).
 */
export function computeTrialStatus(startedAtIso: string | null | undefined, nowMs: number): TrialStatus {
  const startMs = startedAtIso ? Date.parse(startedAtIso) : NaN;

  if (!Number.isFinite(startMs) || !Number.isFinite(nowMs)) {
    return {
      trialActive: false,
      remainingDays: 0,
      startedAt: "",
      endsAt: "",
      elapsedFraction: 0,
    };
  }

  const endMs = startMs + TRIAL_DURATION_DAYS * DAY_MS;
  const trialActive = nowMs < endMs;
  const remainingDays = trialActive ? Math.min(TRIAL_DURATION_DAYS + 1, Math.ceil((endMs - nowMs) / DAY_MS)) : 0;

  const rawElapsed = (nowMs - startMs) / (endMs - startMs);
  const elapsedFraction = Math.max(0, Math.min(1, Number.isFinite(rawElapsed) ? rawElapsed : 0));

  return {
    trialActive,
    remainingDays: Math.max(0, remainingDays),
    startedAt: new Date(startMs).toISOString(),
    endsAt: new Date(endMs).toISOString(),
    elapsedFraction,
  };
}
