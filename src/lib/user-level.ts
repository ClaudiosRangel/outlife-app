// Classificação pura do nível do usuário (spec gamificacao-niveis-rank, item 10).
//
// Regra de faixas combinadas por OR: o usuário sobe de nível ao atingir
// QUALQUER um dos limiares (atividades concluídas, km acumulados ou altimetria
// acumulada) de uma faixa superior. Isso reconhece perfis diferentes — quem faz
// muitas atividades curtas e quem faz poucas mas longas/íngremes.
//
// Função pura e determinística (padrão de `activity-metrics.ts`): não lê estado
// externo, nunca lança, nunca retorna NaN/Infinity. Só contam atividades reais
// concluídas (o chamador filtra por status='completed').

export type UserLevel = "iniciante" | "intermediario" | "avancado";

export interface LevelStats {
  /** Nº de atividades concluídas. */
  completedActivities: number;
  /** Distância acumulada, em km. */
  totalKm: number;
  /** Altimetria acumulada, em metros. */
  totalElevationGain: number;
}

// Limiares de cada faixa (atingir QUALQUER eixo promove). Iniciante é o piso.
// Ajustáveis aqui — única fonte de verdade da regra.
export const LEVEL_THRESHOLDS = {
  intermediario: { activities: 10, km: 50, elevation: 1000 },
  avancado: { activities: 50, km: 300, elevation: 8000 },
} as const;

const EMPTY_STATS: LevelStats = { completedActivities: 0, totalKm: 0, totalElevationGain: 0 };

/** Normaliza um valor numérico para finito e não-negativo (Req 7.1). */
function safe(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Sanitiza as estatísticas (nulos/NaN/negativos → 0). */
export function sanitizeLevelStats(stats: Partial<LevelStats> | null | undefined): LevelStats {
  if (!stats) return { ...EMPTY_STATS };
  return {
    completedActivities: safe(stats.completedActivities ?? 0),
    totalKm: safe(stats.totalKm ?? 0),
    totalElevationGain: safe(stats.totalElevationGain ?? 0),
  };
}

/** `true` se as estatísticas atingem QUALQUER limiar da faixa dada (OR). */
function reaches(
  stats: LevelStats,
  band: { activities: number; km: number; elevation: number },
): boolean {
  return (
    stats.completedActivities >= band.activities ||
    stats.totalKm >= band.km ||
    stats.totalElevationGain >= band.elevation
  );
}

/**
 * Classifica o nível a partir das estatísticas. Total, puro, determinístico —
 * sempre retorna exatamente um de iniciante|intermediario|avancado; piso
 * iniciante quando não há atividade (Req 1.2/1.3/1.4).
 */
export function classifyLevel(rawStats: Partial<LevelStats> | null | undefined): UserLevel {
  const stats = sanitizeLevelStats(rawStats);
  if (reaches(stats, LEVEL_THRESHOLDS.avancado)) return "avancado";
  if (reaches(stats, LEVEL_THRESHOLDS.intermediario)) return "intermediario";
  return "iniciante";
}

/**
 * Progresso 0–100 rumo ao próximo nível (Req 1.5). No nível máximo (avancado),
 * retorna 100. Usa a MAIOR fração entre os três eixos rumo ao limiar da próxima
 * faixa (o eixo em que o usuário está mais perto de subir).
 */
export function levelProgress(rawStats: Partial<LevelStats> | null | undefined): number {
  const stats = sanitizeLevelStats(rawStats);
  const level = classifyLevel(stats);
  if (level === "avancado") return 100;

  const nextBand =
    level === "iniciante" ? LEVEL_THRESHOLDS.intermediario : LEVEL_THRESHOLDS.avancado;

  const fractions = [
    stats.completedActivities / nextBand.activities,
    stats.totalKm / nextBand.km,
    stats.totalElevationGain / nextBand.elevation,
  ];
  const best = Math.max(0, ...fractions);
  return Math.min(100, Math.round(best * 100));
}
