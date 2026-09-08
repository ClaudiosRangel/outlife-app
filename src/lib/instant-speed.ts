// Instant_Speed / Smoothed_Speed: velocidade instantânea suavizada a partir
// dos últimos Accepted_Points de uma User_Activity (spec
// `rastreamento-preciso-gps`).
//
// Motivação (Requirement 4): a velocidade exibida ao vivo NÃO deve ser o
// valor cru de `speed` de uma única leitura de GPS (ruidoso a baixas
// velocidades — causa do "andar" parecer "correr"), mas sim uma média móvel
// sobre uma janela curta de pontos aceitos.
//
// Módulo puro: nenhuma leitura/escrita de estado externo.

import { haversineMeters } from "@/lib/haversine";

/** Ponto usado na janela de velocidade (subset de TrackPoint). */
export interface SpeedWindowPoint {
  lat: number;
  lng: number;
  /** Timestamp em epoch ms. */
  ts: number;
}

/** Número máximo de Accepted_Points mantidos na janela de suavização. */
export const SPEED_WINDOW_SIZE = 5;

/**
 * Idade máxima (ms) do último ponto da janela para a velocidade ser
 * considerada válida. Acima disso, a leitura é "velha" e a velocidade é
 * indisponível (Requirement 4.7) — evita continuar exibindo uma velocidade
 * que já não reflete o movimento atual.
 */
export const SPEED_STALE_MS = 5_000;

/** Número mínimo de pontos para calcular a média móvel. */
const MIN_WINDOW = 2;

/**
 * Calcula a Smoothed_Speed em m/s: soma das distâncias haversine entre
 * pontos consecutivos da janela dividida pela soma dos intervalos de tempo.
 *
 * Retorna `null` (indisponível) quando:
 * - há menos de 2 pontos na janela (Requirement 4.3);
 * - o último ponto é mais velho que `SPEED_STALE_MS` (Requirement 4.7);
 * - a soma dos intervalos de tempo é <= 0 (dados inconsistentes).
 *
 * Nunca retorna `NaN`/`Infinity` — sempre `null` ou um número finito >= 0
 * (Requirement 4.2/4.7, Property 6).
 */
export function computeSmoothedSpeed(
  window: readonly SpeedWindowPoint[],
  nowTs: number,
): number | null {
  if (window.length < MIN_WINDOW) return null;

  const last = window[window.length - 1];
  if (!Number.isFinite(last.ts) || nowTs - last.ts > SPEED_STALE_MS) return null;

  let totalMeters = 0;
  let totalSeconds = 0;
  for (let i = 1; i < window.length; i++) {
    const a = window[i - 1];
    const b = window[i];
    const dt = (b.ts - a.ts) / 1000;
    if (dt <= 0) continue; // ignora pares fora de ordem/simultâneos
    totalMeters += haversineMeters(a, b);
    totalSeconds += dt;
  }

  if (totalSeconds <= 0) return null;

  const speed = totalMeters / totalSeconds;
  if (!Number.isFinite(speed) || speed < 0) return null;
  return speed;
}

/**
 * Retorna uma nova janela com `point` adicionado ao fim, limitada a
 * `maxSize` elementos (descarta os mais antigos). Função pura (não muta a
 * entrada). Útil para o hook manter a janela curta sem lógica inline.
 */
export function pushWindow(
  window: readonly SpeedWindowPoint[],
  point: SpeedWindowPoint,
  maxSize: number = SPEED_WINDOW_SIZE,
): SpeedWindowPoint[] {
  const next = [...window, point];
  return next.length > maxSize ? next.slice(next.length - maxSize) : next;
}

/** Converte m/s para km/h (utilitário puro para a UI). */
export function mpsToKmh(mps: number): number {
  return mps * 3.6;
}
