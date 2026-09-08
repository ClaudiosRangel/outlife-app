// Núcleo de lógica pura da feature "Amigos em Atividade ao Vivo".
//
// Estas funções são puras e agnósticas de React/i18n: o relógio é SEMPRE
// injetado via `nowMs` (nunca `Date.now()` interno), garantindo testabilidade
// determinística (inclusive por testes de propriedade com fast-check).
//
// Decisão de i18n (registrada aqui de propósito): como estas funções não têm
// contexto React, elas NÃO chamam hooks do i18next. `formatLiveRecency`
// retorna um label textual direto em português ("ao vivo" / "há N min"),
// consistente com o restante do projeto, e ainda expõe o booleano `live` para
// que o componente consumidor possa optar por traduzir/formatar por conta
// própria caso queira. O importante é que `live` seja sempre correto e o
// `label` seja consistente e testável.

/**
 * Janela de recência "ao vivo" em milissegundos (DECISÃO-B: 120s / 2 min).
 *
 * Uma posição é considerada recente o suficiente para "ao vivo" quando
 * `nowMs - locationUpdatedAtMs <= LIVE_RECENCY_WINDOW_MS`.
 */
export const LIVE_RECENCY_WINDOW_MS = 120_000;

/**
 * Regra pura de "ao vivo" (Requirements 1.1, 1.2, 1.4, 1.5, 5.3, 6.2).
 *
 * Um amigo é classificado como Live_Activity_Friend SE E SOMENTE SE:
 * - possui uma User_Activity com status `in_progress` (`hasInProgressActivity`);
 * - possui posição publicada (`locationUpdatedAtMs != null`); e
 * - essa posição está dentro do Live_Recency_Window
 *   (`nowMs - locationUpdatedAtMs <= LIVE_RECENCY_WINDOW_MS`).
 *
 * Em particular, se a última atualização de posição ultrapassa 120s, o amigo é
 * reclassificado como compartilhamento estático imediatamente, mesmo que a
 * atividade permaneça `in_progress` (Req 1.4).
 */
export function deriveIsLive(input: {
  hasInProgressActivity: boolean;
  locationUpdatedAtMs: number | null;
  nowMs: number;
}): boolean {
  if (!input.hasInProgressActivity) return false;
  if (input.locationUpdatedAtMs == null) return false;
  return input.nowMs - input.locationUpdatedAtMs <= LIVE_RECENCY_WINDOW_MS;
}

/**
 * Rótulo de recência a partir de `location_updated_at` (Requirement 3.3).
 *
 * Retorna `{ live: true, label: "ao vivo" }` quando a posição está dentro do
 * Live_Recency_Window; caso contrário, `{ live: false, label: "há N min" }`,
 * onde `N = floor((nowMs - locationUpdatedAtMs) / 60000)`.
 */
export function formatLiveRecency(input: { locationUpdatedAtMs: number; nowMs: number }): {
  live: boolean;
  label: string;
} {
  const elapsedMs = input.nowMs - input.locationUpdatedAtMs;

  if (elapsedMs <= LIVE_RECENCY_WINDOW_MS) {
    return { live: true, label: "ao vivo" };
  }

  const minutes = Math.floor(elapsedMs / 60_000);
  return { live: false, label: `há ${minutes} min` };
}
