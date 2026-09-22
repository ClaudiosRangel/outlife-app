// Clima da região via Open-Meteo (grátis, sem API key) para o painel
// "Panorama agora" do Explorar (spec explorar-redesign, fase 2).
// A lógica de veredito outdoor é pura/testável.

export type WeatherNow = {
  temperatureC: number;
  apparentC: number;
  windKmh: number;
  precipitationMm: number;
  precipProbabilityMax: number | null;
  tempMaxC: number | null;
  tempMinC: number | null;
  weatherCode: number;
};

export type OutdoorVerdict = "good" | "caution" | "avoid";

/**
 * Veredito outdoor a partir do clima (puro). Regras conservadoras:
 * - "avoid": tempestade/neve/chuva forte (weather_code severo) OU vento muito
 *   forte (>= 50 km/h) OU alta chance de chuva (>= 80%).
 * - "caution": chuva moderada/probabilidade média, vento forte (>= 30), calor
 *   extremo (>= 38) ou frio (<= 3).
 * - "good": caso contrário.
 */
export function outdoorVerdict(w: {
  windKmh: number;
  precipProbabilityMax: number | null;
  apparentC: number;
  weatherCode: number;
}): OutdoorVerdict {
  const severe = isSevereCode(w.weatherCode);
  const prob = w.precipProbabilityMax ?? 0;
  if (severe || w.windKmh >= 50 || prob >= 80) return "avoid";
  if (
    w.windKmh >= 30 ||
    prob >= 50 ||
    w.apparentC >= 38 ||
    w.apparentC <= 3 ||
    isRainyCode(w.weatherCode)
  ) {
    return "caution";
  }
  return "good";
}

// WMO weather codes (Open-Meteo). Severo: tempestade, neve pesada, chuva
// congelante, granizo.
function isSevereCode(code: number): boolean {
  return (
    (code >= 95 && code <= 99) || // trovoada
    (code >= 71 && code <= 77) || // neve
    (code >= 66 && code <= 67) // chuva congelante
  );
}
function isRainyCode(code: number): boolean {
  return (code >= 51 && code <= 65) || (code >= 80 && code <= 82);
}

/** Chave de tradução curta para o código de clima. */
export function weatherCodeKey(code: number): string {
  if (code === 0) return "clear";
  if (code <= 3) return "cloudy";
  if (code >= 45 && code <= 48) return "fog";
  if (isRainyCode(code)) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 95) return "storm";
  return "cloudy";
}

/** Busca o clima atual + resumo do dia no Open-Meteo (sem key). */
export async function fetchWeatherNow(lat: number, lng: number): Promise<WeatherNow | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,apparent_temperature,precipitation,wind_speed_10m,weather_code` +
    `&daily=precipitation_probability_max,temperature_2m_max,temperature_2m_min` +
    `&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("weather fetch failed");
  const j = (await res.json()) as {
    current?: {
      temperature_2m?: number;
      apparent_temperature?: number;
      precipitation?: number;
      wind_speed_10m?: number;
      weather_code?: number;
    };
    daily?: {
      precipitation_probability_max?: number[];
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
    };
  };
  const cur = j.current;
  if (!cur) return null;
  return {
    temperatureC: Math.round(cur.temperature_2m ?? 0),
    apparentC: Math.round(cur.apparent_temperature ?? cur.temperature_2m ?? 0),
    windKmh: Math.round(cur.wind_speed_10m ?? 0),
    precipitationMm: cur.precipitation ?? 0,
    precipProbabilityMax: j.daily?.precipitation_probability_max?.[0] ?? null,
    tempMaxC: j.daily?.temperature_2m_max?.[0] != null ? Math.round(j.daily.temperature_2m_max[0]) : null,
    tempMinC: j.daily?.temperature_2m_min?.[0] != null ? Math.round(j.daily.temperature_2m_min[0]) : null,
    weatherCode: cur.weather_code ?? 0,
  };
}
