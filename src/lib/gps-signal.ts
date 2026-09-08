// GPS_Signal_State: estado observável da qualidade do sinal de GPS durante
// o rastreamento de uma User_Activity (spec `rastreamento-preciso-gps`,
// Requirement 6).
//
// Derivado do Accuracy_Radius das amostras recentes e do tempo desde a
// última amostra, com precedência determinística entre estados.
//
// Módulo puro: nenhuma leitura/escrita de estado externo.

export type GpsSignalState = "aquisitando" | "bom" | "fraco" | "sem_sinal";

/** Número máximo de amostras recentes consideradas na janela de sinal. */
export const SIGNAL_WINDOW_SIZE = 5;

/**
 * Intervalo (ms) sem receber nenhuma amostra durante o rastreamento ativo
 * acima do qual o sinal é considerado ausente (`sem_sinal`), Requirement 6.2.
 */
export const NO_SIGNAL_TIMEOUT_MS = 8_000;

export interface DeriveGpsSignalInput {
  /** Accuracy_Radius (m) das amostras recentes (mais recente por último). */
  recentAccuracies: readonly number[];
  /** Tempo (ms) desde a última amostra recebida. */
  msSinceLastSample: number;
  /** Se já existe ao menos uma Accepted_Point fixada. */
  hasFirstAcceptedPoint: boolean;
  /** Limiar de acurácia aceitável (m) do perfil ativo. */
  maxAccuracyMeters: number;
}

/**
 * Deriva o GPS_Signal_State com a precedência determinística
 * (Requirement 6.6):
 *   1. `sem_sinal`   — nenhuma amostra há mais de NO_SIGNAL_TIMEOUT_MS
 *   2. `aquisitando` — ainda no warmup, sem primeira Accepted_Point
 *   3. `fraco`       — todas as acurácias recentes piores que o limiar
 *   4. `bom`         — ao menos uma amostra recente dentro do limiar
 *
 * Sempre retorna exatamente um dos quatro estados (Property 8).
 */
export function deriveGpsSignal(input: DeriveGpsSignalInput): GpsSignalState {
  const { recentAccuracies, msSinceLastSample, hasFirstAcceptedPoint, maxAccuracyMeters } = input;

  // 1. sem_sinal tem precedência máxima.
  if (msSinceLastSample > NO_SIGNAL_TIMEOUT_MS) return "sem_sinal";

  // 2. aquisitando: ainda estabilizando a primeira fixação.
  if (!hasFirstAcceptedPoint) return "aquisitando";

  // 3./4. avalia a janela de acurácias.
  const finite = recentAccuracies.filter((a) => Number.isFinite(a));
  if (finite.length === 0) {
    // Sem acurácias válidas mas já houve fixação e há amostras chegando:
    // trata como fraco (qualidade indeterminada não é "bom").
    return "fraco";
  }
  const hasGood = finite.some((a) => a <= maxAccuracyMeters);
  return hasGood ? "bom" : "fraco";
}

/**
 * Mantém a janela de acurácias recentes limitada a `maxSize` (descarta as
 * mais antigas). Função pura.
 */
export function pushAccuracy(
  window: readonly number[],
  accuracy: number,
  maxSize: number = SIGNAL_WINDOW_SIZE,
): number[] {
  const next = [...window, accuracy];
  return next.length > maxSize ? next.slice(next.length - maxSize) : next;
}
