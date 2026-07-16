/**
 * Lógica pura de decisão da Rate_Limiting_Policy (Requirement 12.1).
 *
 * Espelha fielmente a lógica SQL de `public.fn_check_rate_limit`
 * (migration `supabase/migrations/20260715160400_rpc-rate-limiting.sql`):
 *
 *   SELECT count(*) INTO recent_calls
 *     FROM public.rpc_rate_limit_log
 *    WHERE user_id = _user_id
 *      AND rpc_name = _rpc_name
 *      AND called_at > now() - (_window_seconds || ' seconds')::interval;
 *
 *   IF recent_calls >= _max_calls THEN
 *     RAISE EXCEPTION ...;
 *   END IF;
 *
 * Ou seja: conta as chamadas com `called_at > now() - window_seconds` (janela
 * deslizante, limite inferior EXCLUSIVO) e rejeita quando essa contagem já é
 * `>= maxCalls`. Esta função não acessa o banco de dados — é usada para
 * testar a DECISÃO em isolamento (ver tests/property/rate-limit.property.test.ts).
 *
 * @param callTimestamps Timestamps (epoch ms) das chamadas já registradas
 *   para o par (user_id, rpc_name) — equivalente às linhas existentes em
 *   `rpc_rate_limit_log` no momento da checagem.
 * @param now Timestamp (epoch ms) do instante da chamada atual (equivalente
 *   a `now()` no SQL).
 * @param maxCalls Limite máximo de chamadas permitidas na janela (`_max_calls`).
 * @param windowSeconds Duração da janela deslizante em segundos (`_window_seconds`).
 * @returns `true` se a chamada atual deve ser PERMITIDA (registrada), `false`
 *   se deve ser REJEITADA (limite já atingido/excedido).
 */
export function shouldAllowCall(
  callTimestamps: number[],
  now: number,
  maxCalls: number,
  windowSeconds: number,
): boolean {
  const windowStart = now - windowSeconds * 1000;

  const recentCalls = callTimestamps.filter((ts) => ts > windowStart).length;

  return recentCalls < maxCalls;
}
