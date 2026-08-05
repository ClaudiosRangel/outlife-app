// Cálculo puro de Average_Speed/Average_Pace de uma User_Activity, a
// partir da distância percorrida e do tempo decorrido.
//
// Requirement 4.4: enquanto uma User_Activity com Activity_Type igual a
// Caminhada ou Pedalada está em andamento, o Average_Pace (mm:ss/km) deve
// ser exibido.
// Requirement 4.5: enquanto uma User_Activity de qualquer Activity_Type
// está em andamento, o Average_Speed (km/h, 1 casa decimal) deve ser
// exibido.
// Requirement 4.6: no resumo final (Activity_Detail_Screen), o
// Average_Speed é sempre exibido e o Average_Pace também quando o
// Activity_Type for Caminhada ou Pedalada, ambos a partir dos totais
// persistidos.
// Requirement 4.7: quando o tempo decorrido for zero ou a distância não
// puder ser determinada, ambos devem ser exibidos como indisponíveis por
// meio de um indicador tipado — nunca `NaN`/`Infinity`, nunca um valor
// calculado a partir de dados inválidos.
//
// `computeActivityMetrics` é a única fonte de verdade para essa fórmula,
// reaproveitada tanto pelo hook de tracking (live, a cada 1s) quanto pela
// Activity_Detail_Screen (final, a partir dos totais persistidos).

/**
 * Valores válidos de Activity_Type, restritos pelo CHECK constraint de
 * `user_activities.activity_type` (migration
 * `20260721000000_activity-type-and-map-snapshot.sql`).
 */
export type ActivityType = "caminhada" | "pedalada" | "trilha" | "outro";

/** Activity_Type para os quais o Average_Pace é exibido (Requirement 4.4). */
const PACE_ACTIVITY_TYPES: readonly ActivityType[] = ["caminhada", "pedalada"];

export interface ComputeActivityMetricsInput {
  /** Tipo de atividade selecionado; determina se o Average_Pace é calculado. */
  activityType: ActivityType | null | undefined;
  /** Distância percorrida, em metros. */
  distanceMeters: number;
  /** Tempo decorrido, em segundos. */
  durationSeconds: number;
}

export interface ActivityMetrics {
  /**
   * Average_Speed em km/h, formatado com 1 casa decimal (ex.: `"8.3"`), ou
   * `null` quando indisponível (Requirement 4.7) — nunca `NaN`/`Infinity`.
   */
  averageSpeedKmh: string | null;
  /**
   * Average_Pace no formato `mm:ss/km`, ou `null` quando o Activity_Type
   * não for Caminhada/Pedalada, ou quando indisponível (Requirement 4.7).
   */
  averagePaceLabel: string | null;
}

/** Retorna `true` quando a distância é um valor válido para cálculo (finito e não-negativo). */
function isValidDistance(distanceMeters: number): boolean {
  return Number.isFinite(distanceMeters) && distanceMeters >= 0;
}

/** Formata segundos totais (inteiro, não-negativo) no padrão `mm:ss`. */
function formatMinutesSeconds(totalSeconds: number): string {
  const roundedSeconds = Math.round(totalSeconds);
  const minutes = Math.floor(roundedSeconds / 60);
  const seconds = roundedSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Calcula o Average_Speed e, quando aplicável, o Average_Pace de uma
 * User_Activity a partir da distância percorrida e do tempo decorrido.
 *
 * Função pura: não lê nem escreve nenhum estado externo, apenas deriva o
 * resultado dos valores recebidos. Nunca retorna `NaN`/`Infinity` — quando
 * `durationSeconds <= 0` ou a distância é inválida, ambos os campos são
 * `null` (Requirement 4.7).
 */
export function computeActivityMetrics(input: ComputeActivityMetricsInput): ActivityMetrics {
  const { activityType, distanceMeters, durationSeconds } = input;

  if (durationSeconds <= 0 || !Number.isFinite(durationSeconds) || !isValidDistance(distanceMeters)) {
    return { averageSpeedKmh: null, averagePaceLabel: null };
  }

  const distanceKm = distanceMeters / 1000;
  const durationHours = durationSeconds / 3600;
  const averageSpeedKmh = (distanceKm / durationHours).toFixed(1);

  const showsPace = activityType != null && PACE_ACTIVITY_TYPES.includes(activityType);
  if (!showsPace || distanceKm <= 0) {
    return { averageSpeedKmh, averagePaceLabel: null };
  }

  const secondsPerKm = durationSeconds / distanceKm;
  const averagePaceLabel = `${formatMinutesSeconds(secondsPerKm)}/km`;

  return { averageSpeedKmh, averagePaceLabel };
}
