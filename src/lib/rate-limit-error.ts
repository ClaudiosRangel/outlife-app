/**
 * Mapeamento do ERRCODE do Rate_Limiting_Policy (Requirement 12.2) para
 * mensagem de UI.
 *
 * `public.fn_check_rate_limit` (migration
 * `supabase/migrations/20260715160400_rpc-rate-limiting.sql`) lança
 * `RAISE EXCEPTION ... USING ERRCODE = 'P0429'` quando o limite de chamadas
 * é excedido, ANTES de qualquer efeito (INSERT/UPDATE) — ou seja, a chamada
 * rejeitada não persiste nenhum efeito no banco. O `supabase-js` expõe esse
 * código Postgres na propriedade `.code` do erro retornado por `.rpc()`.
 *
 * Esta função centraliza a detecção desse código específico, retornando
 * `null` para qualquer outro erro, de forma que o chamador nunca mascare
 * erros genéricos (rede, validação, etc.) com a mensagem de rate limit.
 */

const RATE_LIMIT_ERRCODE = "P0429";

const RATE_LIMIT_UI_MESSAGE = "Limite atingido, tente novamente em alguns instantes";

/**
 * Recebe o erro capturado (tipicamente vindo de `supabase.rpc()`, tipado
 * como `unknown`) e retorna a mensagem de UI apropriada quando o erro
 * corresponde ao ERRCODE de rate limit (`P0429`), ou `null` caso contrário.
 */
export function mapRateLimitErrorToMessage(error: unknown): string | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === RATE_LIMIT_ERRCODE
  ) {
    return RATE_LIMIT_UI_MESSAGE;
  }
  return null;
}
