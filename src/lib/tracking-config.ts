// Configuração de perfis de rastreamento por Activity_Type.
//
// Fonte única dos limiares usados na Point_Validation e na derivação do
// GPS_Signal_State (spec `rastreamento-preciso-gps`). Todos os valores são
// calibrados por tipo de atividade para que a filtragem de ruído de GPS
// reflita o movimento plausível de cada modalidade — resolvendo o problema
// de "andar" registrar velocidade de "correr" (inflação de distância por
// ruído de sinal).
//
// Módulo puro: apenas constantes e funções sem I/O.

import type { ActivityType } from "@/lib/activity-metrics";

/**
 * Limiares de validação de ponto para um Activity_Type.
 */
export interface TrackingProfile {
  /**
   * Accuracy_Radius máximo aceitável, em metros (Requirement 1). Amostras
   * com acurácia pior (valor maior) que este limiar são descartadas.
   */
  maxAccuracyMeters: number;
  /**
   * Deslocamento mínimo entre pontos aceitos, em metros (Requirement 3).
   * Deslocamentos menores são tratados como deriva de GPS e descartados.
   */
  minDistanceMeters: number;
  /**
   * Speed_Ceiling: velocidade máxima plausível, em m/s (Requirement 2).
   * Deslocamentos que impliquem velocidade maior são "saltos" de GPS.
   */
  maxSpeedMps: number;
}

/**
 * Faixa configurável permitida para o Limiar_Acuracia, em metros
 * (Requirement 1.4). O default de cada perfil deve estar dentro desta faixa
 * e ser estritamente menor que 20 metros.
 */
export const ACCURACY_MIN = 5;
export const ACCURACY_MAX = 20;

/**
 * Política aplicada a uma Raw_Location_Sample sem Accuracy_Radius disponível
 * (Requirement 1.3). Determinística: sempre o mesmo resultado para amostras
 * equivalentes. Padrão: rejeitar (conservador — evita contabilizar pontos de
 * qualidade desconhecida).
 */
export const MISSING_ACCURACY_POLICY: "accept" | "reject" = "reject";

/**
 * Perfis por Activity_Type. Ver `design.md` para a justificativa de cada
 * valor. Invariantes garantidas:
 * - `caminhada.maxSpeedMps` < `pedalada.maxSpeedMps` (Requirement 2.5)
 * - `caminhada.minDistanceMeters` < 2 (Requirement 3.5)
 * - todo `maxAccuracyMeters` default < 20 e dentro de [ACCURACY_MIN, ACCURACY_MAX]
 */
export const TRACKING_PROFILES: Record<ActivityType, TrackingProfile> = {
  // caminhada: ~1,4 m/s em ritmo normal; teto de 4 m/s (~14 km/h) cobre uma
  // corrida leve. minDistance 1,5m: estritamente < 2m atual sem impedir passos.
  caminhada: { maxAccuracyMeters: 12, minDistanceMeters: 1.5, maxSpeedMps: 4 },
  // pedalada: teto de 25 m/s (~90 km/h) cobre descidas.
  pedalada: { maxAccuracyMeters: 15, minDistanceMeters: 5, maxSpeedMps: 25 },
  // trilha: caminhada em terreno irregular; teto de 6 m/s.
  trilha: { maxAccuracyMeters: 15, minDistanceMeters: 1.5, maxSpeedMps: 6 },
  // outro: conservador porém permissivo; teto de 30 m/s.
  outro: { maxAccuracyMeters: 15, minDistanceMeters: 2, maxSpeedMps: 30 },
};

/**
 * Perfil default, aplicado quando o Activity_Type é nulo/desconhecido
 * (Requirement 3.4).
 */
export const DEFAULT_PROFILE: TrackingProfile = TRACKING_PROFILES.outro;

/**
 * Retorna o TrackingProfile do Activity_Type informado, com fallback para
 * `DEFAULT_PROFILE` quando o tipo é nulo, indefinido ou não reconhecido.
 * Função pura.
 */
export function getProfile(type: ActivityType | null | undefined): TrackingProfile {
  if (type != null && type in TRACKING_PROFILES) {
    return TRACKING_PROFILES[type];
  }
  return DEFAULT_PROFILE;
}

/**
 * Valida se um valor de Limiar_Acuracia (metros) está dentro da faixa
 * configurável permitida [ACCURACY_MIN, ACCURACY_MAX] (Requirement 1.4).
 * Função pura.
 */
export function isValidAccuracyThreshold(meters: number): boolean {
  return Number.isFinite(meters) && meters >= ACCURACY_MIN && meters <= ACCURACY_MAX;
}
