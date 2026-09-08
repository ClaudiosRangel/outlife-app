// Point_Validation: decisão pura de aceitar ou rejeitar uma
// Raw_Location_Sample antes de incorporá-la à distância/trajeto de uma
// User_Activity (spec `rastreamento-preciso-gps`).
//
// É o núcleo da filtragem de ruído de GPS que corrige o problema de "andar"
// registrar velocidade de "correr": amostras imprecisas, saltos implausíveis
// (por Speed_Ceiling do tipo de atividade) e deriva com o usuário parado
// (deslocamento mínimo) são descartadas, sem nunca contaminar a distância.
//
// Módulo puro: `validatePoint` não lê nem escreve estado externo — apenas
// deriva o resultado dos argumentos recebidos. O chamador é responsável por
// atualizar a referência (`lastAccepted`) APENAS quando o resultado é
// `accepted: true` (Requirements 2.7, 3.6).

import { haversineMeters } from "@/lib/haversine";
import type { TrackingProfile } from "@/lib/tracking-config";

/** Motivo pelo qual uma amostra foi rejeitada. */
export type RejectionReason = "accuracy" | "missing_accuracy" | "speed_ceiling" | "min_distance";

/** Referência de validação: a última Accepted_Point, ou null se não há origem ainda. */
export interface ValidationRefState {
  lastAccepted: { lat: number; lng: number; ts: number } | null;
}

/** Amostra bruta normalizada das fontes de captura (web/nativo). */
export interface RawSample {
  lat: number;
  lng: number;
  /** Timestamp em epoch ms. */
  ts: number;
  /** Accuracy_Radius em metros; null/undefined quando indisponível. */
  accuracy?: number | null;
  /** Altitude em metros (WGS84); null quando indisponível. */
  altitude?: number | null;
  /** Velocidade do sensor em m/s; null quando indisponível (não usada na validação). */
  speed?: number | null;
}

export type ValidationResult =
  | { accepted: true }
  | { accepted: false; reason: RejectionReason };

const ACCEPTED: ValidationResult = { accepted: true };

/**
 * Decide o destino de uma Raw_Location_Sample dada a referência atual e o
 * perfil do Activity_Type. Ordem de avaliação determinística:
 *
 * 1. Acurácia (Req 1): sem `accuracy` → aplica `missingAccuracyPolicy`;
 *    `accuracy > maxAccuracyMeters` → reject `accuracy`.
 * 2. Primeira origem (Req 2.6/5.3): sem `lastAccepted` → accept (vira a
 *    origem; não avalia distância nem velocidade).
 * 3. Speed_Ceiling (Req 2): `dt <= 0` → reject `speed_ceiling` (guarda
 *    determinística, sem divisão por zero); `v > maxSpeedMps` → reject.
 * 4. Deslocamento mínimo (Req 3): `d < minDistanceMeters` → reject.
 * 5. Caso contrário → accept.
 *
 * Nunca lança, nunca retorna `NaN`/`Infinity`, nunca estado indefinido.
 */
export function validatePoint(
  sample: RawSample,
  ref: ValidationRefState,
  profile: TrackingProfile,
  missingAccuracyPolicy: "accept" | "reject",
): ValidationResult {
  // 1. Acurácia
  const accuracy = sample.accuracy;
  if (accuracy == null || !Number.isFinite(accuracy)) {
    if (missingAccuracyPolicy === "reject") {
      return { accepted: false, reason: "missing_accuracy" };
    }
    // política "accept": segue para os demais critérios como se acurácia OK.
  } else if (accuracy > profile.maxAccuracyMeters) {
    return { accepted: false, reason: "accuracy" };
  }

  // 2. Primeira origem: sem referência, aceita sem avaliar deslocamento.
  const last = ref.lastAccepted;
  if (last == null) {
    return ACCEPTED;
  }

  // 3. Speed_Ceiling
  const dtSeconds = (sample.ts - last.ts) / 1000;
  const distance = haversineMeters(last, sample);
  if (dtSeconds <= 0) {
    // Timestamps iguais, ausentes ou fora de ordem: política determinística
    // (rejeita) — nunca divide por intervalo nulo (Req 2.4).
    return { accepted: false, reason: "speed_ceiling" };
  }
  const speedMps = distance / dtSeconds;
  if (speedMps > profile.maxSpeedMps) {
    return { accepted: false, reason: "speed_ceiling" };
  }

  // 4. Deslocamento mínimo
  if (distance < profile.minDistanceMeters) {
    return { accepted: false, reason: "min_distance" };
  }

  // 5. Aceita
  return ACCEPTED;
}
