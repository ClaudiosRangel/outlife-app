import { describe, it } from 'vitest';
import fc from 'fast-check';
import { shouldAllowCall } from '../../src/lib/rate-limiter';

/**
 * Property test da Rate_Limiting_Policy (task 5.6 do spec outlife-production-plan).
 *
 * IMPORTANTE: este teste valida a LÓGICA de decisão do rate limiter, extraída
 * como função pura (`shouldAllowCall` em `src/lib/rate-limiter.ts`) que
 * espelha fielmente o corpo SQL de `public.fn_check_rate_limit` (migration
 * `supabase/migrations/20260715160400_rpc-rate-limiting.sql`). Não é um
 * teste de integração contra a execução real da função no Postgres —
 * Docker não está disponível neste ambiente, o que impede rodar o Supabase
 * local necessário para testar a RPC real. A tarefa 5.7 (aplicar as
 * migrations no Production_Supabase_Project) e qualquer validação futura em
 * ambiente com Docker disponível permanecem como a via de confirmação da
 * execução real contra Postgres.
 */

describe('Rate_Limiting_Policy — fn_check_rate_limit (lógica de decisão)', () => {
  it('nunca permite mais de maxCalls chamadas dentro de qualquer janela deslizante', () => {
    // Feature: outlife-production-plan, Property 13: Decisão da Rate_Limiting_Policy nunca permite exceder o limite por janela
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 1_000_000 }), { minLength: 0, maxLength: 50 }),
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 3600 }),
        (rawTimestamps, now, maxCalls, windowSeconds) => {
          // callTimestamps representam chamadas JÁ registradas antes da
          // chamada atual (equivalente às linhas existentes em
          // rpc_rate_limit_log no momento da checagem).
          const callTimestamps = rawTimestamps.map((t) => t * 1000); // epoch ms
          const nowMs = now * 1000;

          const windowStart = nowMs - windowSeconds * 1000;
          const recentCallsBefore = callTimestamps.filter((ts) => ts > windowStart).length;

          const allowed = shouldAllowCall(callTimestamps, nowMs, maxCalls, windowSeconds);

          // Se já havia >= maxCalls chamadas na janela, a chamada atual DEVE
          // ser rejeitada (nunca deve ser permitida, o que faria o total
          // exceder o limite).
          if (recentCallsBefore >= maxCalls) {
            return allowed === false;
          }

          // Caso contrário, a chamada atual deve ser permitida, e o total
          // resultante (chamadas anteriores na janela + esta) nunca excede
          // maxCalls.
          return allowed === true && recentCallsBefore + 1 <= maxCalls;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rejeita sempre que recentCalls >= maxCalls, mesmo com chamadas concentradas na mesma janela', () => {
    // Feature: outlife-production-plan, Property 13: Decisão da Rate_Limiting_Policy nunca permite exceder o limite por janela
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }), // maxCalls
        fc.integer({ min: 1, max: 3600 }), // windowSeconds
        fc.integer({ min: 0, max: 1_000_000 }), // now (segundos)
        (maxCalls, windowSeconds, now) => {
          const nowMs = now * 1000;
          // Gera exatamente maxCalls chamadas concentradas dentro da mesma
          // janela (todas no instante `now`), simulando o caso de abuso mais
          // direto: N chamadas na mesma janela.
          const callTimestamps = Array.from({ length: maxCalls }, () => nowMs);

          return shouldAllowCall(callTimestamps, nowMs, maxCalls, windowSeconds) === false;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('permite chamadas fora da janela deslizante (espalhadas em janelas distintas), independente de chamadas antigas', () => {
    // Feature: outlife-production-plan, Property 13: Decisão da Rate_Limiting_Policy nunca permite exceder o limite por janela
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }), // maxCalls
        fc.integer({ min: 1, max: 3600 }), // windowSeconds
        fc.integer({ min: 3600, max: 1_000_000 }), // now (segundos), grande o suficiente para ter passado antigo
        (maxCalls, windowSeconds, now) => {
          const nowMs = now * 1000;
          // Chamadas antigas, todas ANTES do início da janela atual (janela
          // distinta no passado) — não devem contar para o limite atual,
          // mesmo que excedam maxCalls sozinhas.
          const windowStart = nowMs - windowSeconds * 1000;
          const oldTimestamp = windowStart - 1000; // 1s antes do início da janela
          const callTimestamps = Array.from({ length: maxCalls * 2 }, () => oldTimestamp);

          return shouldAllowCall(callTimestamps, nowMs, maxCalls, windowSeconds) === true;
        },
      ),
      { numRuns: 100 },
    );
  });
});
