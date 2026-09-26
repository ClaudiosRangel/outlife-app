// Pontuação da Liga semanal (Bloco 2). Função PURA, espelha exatamente a
// expressão SQL `league_points_expr` (migration league-weekly), para o
// frontend poder prever/exibir pontos e para ser testável sem banco.
//
// Regra: 1 ponto por 100 m percorridos + 1 ponto por metro de elevação ganho.
// Determinística e não-negativa. Distância em METROS, elevação em METROS.

export type LeagueActivity = {
  activityType: string | null;
  distanceMeters: number | null;
  elevationGain: number | null;
};

/** Pontos de UMA atividade. Inteiro >= 0, nunca NaN/Infinity. */
export function leaguePoints(distanceMeters: number | null, elevationGain: number | null): number {
  const dist = Number.isFinite(distanceMeters as number) ? Math.max(0, distanceMeters as number) : 0;
  const elev = Number.isFinite(elevationGain as number) ? Math.max(0, elevationGain as number) : 0;
  return Math.round(dist / 100) + Math.round(elev);
}

/**
 * Soma os pontos de uma lista de atividades. Quando `type` é informado, conta
 * SOMENTE as atividades daquele tipo (isolamento por modalidade — Property 3).
 * `type = null` soma todas (liga "geral").
 */
export function sumLeaguePoints(activities: LeagueActivity[], type: string | null = null): number {
  let total = 0;
  for (const a of activities) {
    if (type !== null && a.activityType !== type) continue;
    total += leaguePoints(a.distanceMeters, a.elevationGain);
  }
  return total;
}
