import { describe, it } from 'vitest';
import fc from 'fast-check';
import {
  ACHIEVEMENT_RULES,
  grantPendingAchievements,
  type AchievementRuleCode,
  type UserAchievementStats,
} from '@/lib/achievement-rules';

/**
 * Task 5.4 do spec outlife-production-plan.
 *
 * IMPORTANTE — o que este teste valida:
 * Este teste valida a LÓGICA de decisão das Achievement_Rule (catálogo e
 * limiares), espelhada em TypeScript puro em `src/lib/achievement-rules.ts`
 * a partir da migration SQL `20260715160300_achievement-records.sql`
 * (função `grant_pending_achievements`, tabela `achievement_records`, view
 * `user_achievement_stats`).
 *
 * Ele NÃO executa a função SQL real contra um banco Postgres. O design.md e
 * o tasks.md pedem que a Property 8 rode contra um "banco de teste
 * local/efêmero (nunca o Production_Supabase_Project real)", tipicamente via
 * `supabase start` (Docker). Neste ambiente de desenvolvimento, o Docker não
 * está disponível (`docker --version` não é reconhecido), tornando
 * inviável levantar uma instância Postgres local/efêmera. Para não deixar a
 * Correctness Property sem cobertura, a lógica de decisão foi extraída para
 * uma função pura testável e este teste valida essa função pura.
 *
 * Quando Docker/Postgres local estiver disponível, este teste pode ser
 * complementado (ou substituído) por uma versão que chama
 * `grant_pending_achievements` via RPC contra uma instância `supabase start`
 * efêmera, validando o mesmo contrato diretamente na função SQL.
 */

const RULE_CODES: AchievementRuleCode[] = ACHIEVEMENT_RULES.map((r) => r.code);

const statsArbitrary: fc.Arbitrary<UserAchievementStats> = fc.record({
  totalKm: fc.double({ min: 0, max: 2000, noNaN: true }),
  completedActivitiesCount: fc.integer({ min: 0, max: 50 }),
  distinctDestinationsCount: fc.integer({ min: 0, max: 50 }),
  photoReviewsCount: fc.integer({ min: 0, max: 50 }),
});

const alreadyGrantedArbitrary: fc.Arbitrary<Set<AchievementRuleCode>> = fc
  .subarray(RULE_CODES)
  .map((codes) => new Set(codes));

describe('grantPendingAchievements (lógica de decisão espelhada de grant_pending_achievements)', () => {
  it(
    // Feature: outlife-production-plan, Property 8: Concessão de Achievement_Record é completa, correta e sem duplicação
    'concede exatamente as regras cujo limiar é atingido e ainda não possuídas, nunca duplica as já possuídas, nunca concede as não atingidas',
    () => {
      fc.assert(
        fc.property(statsArbitrary, alreadyGrantedArbitrary, (stats, alreadyGranted) => {
          const newlyGranted = grantPendingAchievements(stats, alreadyGranted);

          for (const rule of ACHIEVEMENT_RULES) {
            const satisfied = rule.isSatisfiedBy(stats);
            const wasAlreadyGranted = alreadyGranted.has(rule.code);
            const isNewlyGranted = newlyGranted.has(rule.code);

            // Completude: limiar atingido + ainda não possuída => concedida exatamente uma vez.
            if (satisfied && !wasAlreadyGranted) {
              if (!isNewlyGranted) return false;
            }

            // Correção: limiar não atingido => nunca concedida.
            if (!satisfied) {
              if (isNewlyGranted) return false;
            }

            // Sem duplicação: já possuída => nunca retornada novamente,
            // independentemente de o limiar continuar satisfeito.
            if (wasAlreadyGranted) {
              if (isNewlyGranted) return false;
            }
          }

          return true;
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    // Feature: outlife-production-plan, Property 8: Concessão de Achievement_Record é completa, correta e sem duplicação
    'executar a função repetidamente sobre o resultado acumulado nunca produz uma nova concessão (idempotência)',
    () => {
      fc.assert(
        fc.property(statsArbitrary, alreadyGrantedArbitrary, (stats, alreadyGranted) => {
          const firstRun = grantPendingAchievements(stats, alreadyGranted);

          const accumulated = new Set<AchievementRuleCode>([
            ...alreadyGranted,
            ...firstRun,
          ]);

          const secondRun = grantPendingAchievements(stats, accumulated);

          return secondRun.size === 0;
        }),
        { numRuns: 100 },
      );
    },
  );
});
