// Deriva "situações agravantes" a partir do clima (Bloco 3). PURA e
// determinística: só sinaliza quando os limiares são excedidos. Usada no badge
// "Atenção" da tela de destino e (futuro) durante a navegação.

export type WeatherAlertInput = {
  code: number;            // WMO weather_code atual
  windKmh: number;
  uvMax: number | null;
  precipitation: number;   // mm na hora atual
  maxPrecipProbNextHours?: number; // % máx de prob. de chuva nas próximas horas
};

export type WeatherAlert = {
  level: "info" | "warning" | "danger";
  code: "storm" | "heavy_rain" | "rain_likely" | "high_uv" | "strong_wind";
};

// Limiares (padrão de mercado, conservadores).
const UV_HIGH = 8;               // UV >= 8 = muito alto
const WIND_STRONG_KMH = 35;      // vento forte
const RAIN_MM = 2;               // chuva significativa na hora
const RAIN_PROB = 70;            // alta probabilidade de chuva

/**
 * Retorna a lista de alertas ativos (pode ser vazia). Determinística.
 */
export function deriveWeatherAlerts(w: WeatherAlertInput): WeatherAlert[] {
  const alerts: WeatherAlert[] = [];
  // Tempestade (código WMO 95-99).
  if (w.code >= 95 && w.code <= 99) {
    alerts.push({ level: "danger", code: "storm" });
  }
  // Chuva forte agora.
  if (w.precipitation >= RAIN_MM) {
    alerts.push({ level: "warning", code: "heavy_rain" });
  } else if ((w.maxPrecipProbNextHours ?? 0) >= RAIN_PROB) {
    // Alta probabilidade de chuva adiante (só se não já está chovendo forte).
    alerts.push({ level: "warning", code: "rain_likely" });
  }
  // UV muito alto.
  if (w.uvMax != null && w.uvMax >= UV_HIGH) {
    alerts.push({ level: "warning", code: "high_uv" });
  }
  // Vento forte.
  if (w.windKmh >= WIND_STRONG_KMH) {
    alerts.push({ level: "warning", code: "strong_wind" });
  }
  return alerts;
}

/** true se há qualquer alerta (para o badge "Atenção"). */
export function hasWeatherAlert(w: WeatherAlertInput): boolean {
  return deriveWeatherAlerts(w).length > 0;
}
