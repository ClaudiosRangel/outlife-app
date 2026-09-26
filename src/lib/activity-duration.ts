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

/**
 * Tempo TOTAL (segundos) da atividade: do início ao fim, contando TODAS as
 * paradas (pausa manual e auto-pausa). Usa timestamps de RELÓGIO
 * (`startedAtMs`/`endMs`), portanto é imune à suspensão do contador do timer
 * quando o app vai a segundo plano — ao contrário do Moving_Time, que congela
 * nas paradas.
 *
 * - `startedAtMs`: epoch ms do início da atividade (Date.now() no start).
 *   Quando null/inválido (ex.: atividade restaurada de versão antiga sem esse
 *   campo), cai para o span dos pontos (`elapsedFromPoints`).
 * - `endMs`: epoch ms do fim (default = agora).
 * - `points`: pontos aceitos (para o piso pelo span e para o fallback).
 *
 * Garante: inteiro `>= 0`, nunca NaN/Infinity, e sempre `>= elapsedFromPoints`.
 */
export function elapsedTotalSeconds(
  startedAtMs: number | null,
  endMs: number,
  points: { ts: number }[],
): number {
  const spanFloor = elapsedFromPoints(points);
  if (startedAtMs == null || !Number.isFinite(startedAtMs) || !Number.isFinite(endMs)) {
    return spanFloor;
  }
  const sec = Math.round((endMs - startedAtMs) / 1000);
  const total = sec > 0 ? sec : 0;
  // O total nunca pode ser menor que o intervalo entre 1º e último ponto.
  return Math.max(total, spanFloor);
}
