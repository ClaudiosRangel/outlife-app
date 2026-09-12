// Cálculo puro de métricas de uma User_Activity por Metric_Form (Frente D,
// Req 5). Estende a ideia de `activity-metrics.ts` para suportar formas de
// métrica configuráveis por Activity_Type no Activity_Type_Catalog.
//
// Formas suportadas:
// - pace_km         → ritmo min/km (corrida, caminhada); + velocidade km/h.
// - speed_elevation → velocidade km/h (pedalada, trilha, remo, escalada);
//                     + ganho de elevação (m) como métrica secundária.
// - pace_100m       → ritmo por 100 m (natação).
//
// Nunca retorna NaN/Infinity: duração 0 / distância inválida → tudo null.

export type MetricForm = "pace_km" | "speed_elevation" | "pace_100m";

export interface MetricInput {
  distanceMeters: number;
  durationSeconds: number;
  /** ganho de elevação em metros (usado por speed_elevation). */
  elevationGain?: number | null;
}

export interface MetricLine {
  label: string; // rótulo curto ("Ritmo", "Velocidade", "Ganho de elev.")
  value: string; // valor já formatado ("5:49/km", "26.7 km/h", "479 m")
}

export interface MetricOutput {
  /** métrica principal do tipo, ou null se indisponível. */
  primary: MetricLine | null;
  /** métrica secundária (ex.: elevação), ou null. */
  secondary: MetricLine | null;
  /** velocidade média km/h formatada (1 casa), ou null. */
  speedKmh: string | null;
}

function isValidDistance(m: number): boolean {
  return Number.isFinite(m) && m >= 0;
}

function isValidDuration(s: number): boolean {
  return Number.isFinite(s) && s > 0;
}

// Distância mínima (em metros) para calcular ritmo/velocidade. Abaixo disso a
// divisão gera valores absurdos/instáveis (ex.: distâncias subnormais ~1e-322
// produzem "ritmo" gigante). 1 metro é um piso seguro para atividade real.
const MIN_SIGNIFICANT_METERS = 1;

/** Garante que o valor formatado é finito; senão retorna null. */
function finiteOrNull(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

/** Formata segundos totais no padrão mm:ss (minutos podem passar de 59). */
function fmtMinSec(totalSeconds: number): string {
  const r = Math.round(totalSeconds);
  const m = Math.floor(r / 60);
  const s = r % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function speedKmhOrNull(distanceMeters: number, durationSeconds: number): string | null {
  if (!isValidDuration(durationSeconds) || !isValidDistance(distanceMeters)) return null;
  const km = distanceMeters / 1000;
  const hours = durationSeconds / 3600;
  const v = km / hours;
  if (!Number.isFinite(v)) return null;
  return v.toFixed(1);
}

/** Ganho de elevação formatado "N m", ou "0 m" quando ausente/negativo. */
function elevationLabel(elevationGain?: number | null): string {
  const g = typeof elevationGain === "number" && Number.isFinite(elevationGain) && elevationGain > 0
    ? Math.round(elevationGain)
    : 0;
  return `${g} m`;
}

/**
 * Calcula as métricas de uma atividade conforme a Metric_Form. Função pura.
 */
export function computeByMetricForm(form: MetricForm, input: MetricInput): MetricOutput {
  const { distanceMeters, durationSeconds, elevationGain } = input;
  const speedKmh = speedKmhOrNull(distanceMeters, durationSeconds);
  const distanceKm = distanceMeters / 1000;

  const invalid = !isValidDuration(durationSeconds) || !isValidDistance(distanceMeters);

  switch (form) {
    case "pace_km": {
      if (invalid || distanceMeters < MIN_SIGNIFICANT_METERS) {
        return { primary: null, secondary: null, speedKmh };
      }
      const secPerKm = finiteOrNull(durationSeconds / distanceKm);
      if (secPerKm === null) return { primary: null, secondary: null, speedKmh };
      return {
        primary: { label: "Ritmo", value: `${fmtMinSec(secPerKm)}/km` },
        secondary: null,
        speedKmh,
      };
    }
    case "speed_elevation": {
      return {
        primary: speedKmh ? { label: "Velocidade", value: `${speedKmh} km/h` } : null,
        secondary: { label: "Ganho de elev.", value: elevationLabel(elevationGain) },
        speedKmh,
      };
    }
    case "pace_100m": {
      if (invalid || distanceMeters < MIN_SIGNIFICANT_METERS) {
        return { primary: null, secondary: null, speedKmh };
      }
      const hundreds = distanceMeters / 100;
      const secPer100 = finiteOrNull(durationSeconds / hundreds);
      if (secPer100 === null) return { primary: null, secondary: null, speedKmh };
      return {
        primary: { label: "Ritmo", value: `${fmtMinSec(secPer100)}/100m` },
        secondary: null,
        speedKmh,
      };
    }
    default:
      return { primary: null, secondary: null, speedKmh };
  }
}
