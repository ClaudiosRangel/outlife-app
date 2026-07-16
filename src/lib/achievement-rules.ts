// Espelho em TypeScript puro da lógica de decisão implementada em SQL pela
// função `grant_pending_achievements` (ver
// supabase/migrations/20260715160300_achievement-records.sql).
//
// Existe exclusivamente para permitir testar a LÓGICA de decisão das
// Achievement_Rule (catálogo de regras e limiares) sem depender de uma
// instância Postgres local (Docker/`supabase start` não disponíveis neste
// ambiente de desenvolvimento). Não substitui a função SQL em produção — a
// concessão real de Achievement_Record continua ocorrendo inteiramente em
// `grant_pending_achievements`, chamada pelos triggers do banco.
//
// Qualquer alteração no catálogo de regras/limiares da migration SQL deve
// ser replicada aqui para que este espelho continue fiel.

export interface UserAchievementStats {
  totalKm: number;
  completedActivitiesCount: number;
  distinctDestinationsCount: number;
  photoReviewsCount: number;
}

export type AchievementRuleCode =
  | 'first_activity'
  | 'km_100'
  | 'km_500'
  | 'explorer'
  | 'top_reviewer';

interface AchievementRuleDefinition {
  code: AchievementRuleCode;
  isSatisfiedBy: (stats: UserAchievementStats) => boolean;
}

// Catálogo de Achievement_Rule, replicando exatamente as 5 regras e limiares
// definidos em `grant_pending_achievements` (mesma ordem da migration SQL).
export const ACHIEVEMENT_RULES: readonly AchievementRuleDefinition[] = [
  {
    code: 'first_activity',
    isSatisfiedBy: (stats) => stats.completedActivitiesCount >= 1,
  },
  {
    code: 'km_100',
    isSatisfiedBy: (stats) => stats.totalKm >= 100,
  },
  {
    code: 'km_500',
    isSatisfiedBy: (stats) => stats.totalKm >= 500,
  },
  {
    code: 'explorer',
    isSatisfiedBy: (stats) => stats.distinctDestinationsCount >= 5,
  },
  {
    code: 'top_reviewer',
    isSatisfiedBy: (stats) => stats.photoReviewsCount >= 5,
  },
];

/**
 * Determina o conjunto de novos `rule_code` a conceder para um usuário,
 * dadas suas estatísticas atuais e o conjunto de `rule_code` já concedidos.
 *
 * Espelha o comportamento de `INSERT ... ON CONFLICT (user_id, rule_code)
 * DO NOTHING` dentro de `grant_pending_achievements`: toda regra cujo
 * limiar é atingido e que ainda não está em `alreadyGranted` entra no
 * resultado; regras já concedidas nunca são retornadas novamente (mesmo que
 * o limiar continue sendo atingido); regras cujo limiar não é atingido
 * nunca são retornadas.
 */
export function grantPendingAchievements(
  stats: UserAchievementStats,
  alreadyGranted: ReadonlySet<AchievementRuleCode>,
): Set<AchievementRuleCode> {
  const newlyGranted = new Set<AchievementRuleCode>();

  for (const rule of ACHIEVEMENT_RULES) {
    if (alreadyGranted.has(rule.code)) {
      continue;
    }
    if (rule.isSatisfiedBy(stats)) {
      newlyGranted.add(rule.code);
    }
  }

  return newlyGranted;
}
