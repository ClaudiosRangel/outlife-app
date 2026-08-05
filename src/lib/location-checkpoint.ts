// Lógica pura do Location_Persistence_Checkpoint: o momento em que os
// pontos de localização capturados durante uma User_Activity em andamento
// devem ser persistidos localmente no dispositivo.
//
// Requirement 3.1: enquanto uma User_Activity está com status `in_progress`,
// a persistência local dos pontos capturados deve ocorrer exatamente em
// cada Location_Persistence_Checkpoint, disparado somente quando ao menos
// 10 segundos tiverem transcorrido OU ao menos 50 metros tiverem sido
// percorridos desde o checkpoint anterior (o que ocorrer primeiro) — nunca
// persistindo de forma contínua a cada ponto capturado.
//
// `shouldCheckpoint` é a única fonte de verdade para essa decisão,
// independente da fonte dos pontos (Web Geolocation API ou
// Native_Location_Tracking_Module), consumida por `use-activity-tracker.ts`
// no lugar do atual `points.length % 10 === 0`.

/** Intervalo mínimo, em milissegundos, entre dois checkpoints consecutivos. */
export const CHECKPOINT_MIN_INTERVAL_MS = 10_000;

/** Distância mínima, em metros, entre dois checkpoints consecutivos. */
export const CHECKPOINT_MIN_DISTANCE_METERS = 50;

export interface ShouldCheckpointInput {
  /** Timestamp (epoch ms) do último Location_Persistence_Checkpoint realizado. */
  lastCheckpointTs: number;
  /** Distância acumulada (metros) no momento do último checkpoint realizado. */
  lastCheckpointDistanceAccum: number;
  /** Timestamp (epoch ms) atual, a ser avaliado para decidir o próximo checkpoint. */
  nowTs: number;
  /** Distância acumulada (metros) no momento atual. */
  distanceAccum: number;
}

/**
 * Retorna `true` se e somente se ao menos `CHECKPOINT_MIN_INTERVAL_MS`
 * (10s) tiverem transcorrido, ou ao menos `CHECKPOINT_MIN_DISTANCE_METERS`
 * (50m) tiverem sido percorridos, desde o último Location_Persistence_Checkpoint.
 *
 * Função pura: não lê nem escreve nenhum estado externo, apenas compara os
 * valores recebidos.
 */
export function shouldCheckpoint(input: ShouldCheckpointInput): boolean {
  const elapsedMs = input.nowTs - input.lastCheckpointTs;
  const distanceSinceLastCheckpoint = input.distanceAccum - input.lastCheckpointDistanceAccum;

  return (
    elapsedMs >= CHECKPOINT_MIN_INTERVAL_MS || distanceSinceLastCheckpoint >= CHECKPOINT_MIN_DISTANCE_METERS
  );
}
