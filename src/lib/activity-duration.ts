// Cálculo puro de duração real de uma atividade a partir dos timestamps dos
// pontos GPS. Extraído do tracker para ser testável sem puxar Capacitor.
//
// Motivo (bug corrigido): o contador do timer (setInterval) é congelado pelo
// Android quando o app vai a segundo plano, mas o GPS nativo continua enviando
// pontos — a distância crescia sem o `duration` acompanhar, inflando a
// velocidade média (ex.: 47 km/h numa pedalada). O tempo entre o 1º e o último
// ponto é a duração REAL do trajeto e serve de piso para a duração final.

/**
 * Tempo decorrido (segundos) entre o primeiro e o último ponto aceito.
 * 0 para vazio/1 ponto ou timestamps inválidos. Nunca negativo/NaN.
 */
export function elapsedFromPoints(points: { ts: number }[]): number {
  if (!points || points.length < 2) return 0;
  const first = points[0]?.ts;
  const last = points[points.length - 1]?.ts;
  if (!Number.isFinite(first) || !Number.isFinite(last)) return 0;
  const sec = Math.round((last - first) / 1000);
  return sec > 0 ? sec : 0;
}
