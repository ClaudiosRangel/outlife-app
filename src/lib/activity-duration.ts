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

/**
 * Moving_Time final (segundos) de uma atividade, GARANTINDO a invariante
 * `0 <= movingTime <= elapsedTotal`.
 *
 * - `timerSeconds`: valor acumulado pelo contador (setInterval), que avança só
 *   enquanto há movimento (o auto-pause para o timer na inatividade).
 * - `points`: pontos aceitos (para o piso pelo span, caso o timer tenha sido
 *   suspenso em 2º plano e ficado abaixo do tempo real do trajeto).
 * - `elapsedTotalSeconds`: Tempo Total (relógio início→fim) — teto do
 *   Moving_Time.
 *
 * Motivo (bug corrigido — registros incoerentes): quando o app ficava horas
 * em 2º plano/aberto parado, a restauração somava tempo de RELÓGIO ao
 * Moving_Time, inflando-o até quase o Tempo Total mesmo sem movimento real —
 * resultando em velocidade média/ritmo absurdos (ex.: 1,87 km em 7h =
 * 0,3 km/h). O Moving_Time nunca pode exceder o tempo total decorrido.
 *
 * Garante: inteiro `>= 0`, nunca NaN/Infinity, e sempre `<= elapsedTotal`.
 */
export function movingTimeSeconds(
  timerSeconds: number,
  points: { ts: number }[],
  elapsedTotal: number,
): number {
  const safeElapsed =
    Number.isFinite(elapsedTotal) && elapsedTotal > 0 ? Math.round(elapsedTotal) : 0;
  const safeTimer = Number.isFinite(timerSeconds) && timerSeconds > 0 ? Math.round(timerSeconds) : 0;
  const floor = elapsedFromPoints(points);
  const moving = Math.max(safeTimer, floor);
  return Math.min(moving, safeElapsed);
}
