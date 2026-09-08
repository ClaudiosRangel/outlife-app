// Núcleo de lógica pura da publicação ao vivo da feature
// "Amigos em Atividade ao Vivo".
//
// Esta função é pura e agnóstica de React: o relógio é SEMPRE injetado via
// `nowMs` (nunca `Date.now()` interno), garantindo testabilidade
// determinística (inclusive por testes de propriedade com fast-check).
//
// A decisão de publicação foi extraída do `useLiveActivityPublisher` (hook)
// para um ponto único e testável, seguindo o mesmo padrão de `live-activity.ts`.

import type { LocationSharingMode } from "@/lib/api";
import type { TrackerStatus } from "@/hooks/use-activity-tracker";

/**
 * Cadência mínima de publicação da posição ao vivo durante o rastreamento
 * (DECISÃO-C: ~15s). No máximo uma publicação a cada
 * `LIVE_PUBLISH_INTERVAL_MS`, evitando publicar a cada ponto de GPS capturado.
 */
export const LIVE_PUBLISH_INTERVAL_MS = 15_000;

/**
 * Decisão pura de publicação — autorização + throttle
 * (Requirements 2.1, 2.2, 2.3, 2.6, 6.1, 6.2).
 *
 * Retorna `true` SE E SOMENTE SE:
 * - o Activity_Tracker está em `tracking` (`status === 'tracking'`); E
 * - o Live_Activity_Consent está concedido (`mode !== 'none'`); E
 * - nunca publicou ainda (`lastPublishedAtMs == null`) OU já se passou ao menos
 *   o Live_Publish_Interval desde a última publicação
 *   (`nowMs - lastPublishedAtMs >= LIVE_PUBLISH_INTERVAL_MS`).
 *
 * Consequentemente: com `mode === 'none'` nunca publica; com status diferente
 * de `tracking` (incluindo `paused`) nunca publica; e duas publicações
 * consecutivas nunca ocorrem com intervalo menor que o Live_Publish_Interval.
 */
export function shouldPublish(input: {
  status: TrackerStatus;
  mode: LocationSharingMode;
  nowMs: number;
  lastPublishedAtMs: number | null;
}): boolean {
  if (input.status !== "tracking") return false;
  if (input.mode === "none") return false;
  if (input.lastPublishedAtMs == null) return true;
  return input.nowMs - input.lastPublishedAtMs >= LIVE_PUBLISH_INTERVAL_MS;
}
