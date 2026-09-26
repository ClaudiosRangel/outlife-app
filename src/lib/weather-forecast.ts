// Clima detalhado (atual + horária + UV/sol) via Open-Meteo (gratuita, sem
// chave) para a TELA DE DESTINO (Bloco 3, Fase B). Separado de `weather.ts`
// (que serve ao painel do Explorar) para não colidir. Alertas em
// `weather-alerts.ts` (puro/testável).

export type WeatherHour = { time: string; tempC: number; precipProb: number; code: number };

export type DestinationWeather = {
  tempC: number;
  feelsLikeC: number;
  humidity: number;
  precipitation: number;
  windKmh: number;
  code: number;
  uvMax: number | null;
  minC: number | null;
  maxC: number | null;
  sunrise: string | null;
  sunset: string | null;
  hourly: WeatherHour[];
};

/** Descrição curta do WMO weather_code (pt-BR). */
export function weatherCodeLabel(code: number): string {
  if (code === 0) return "Céu limpo";
  if (code <= 2) return "Parcialmente nublado";
  if (code === 3) return "Nublado";
  if (code <= 48) return "Névoa";
  if (code <= 57) return "Garoa";
  if (code <= 67) return "Chuva";
  if (code <= 77) return "Neve";
  if (code <= 82) return "Pancadas de chuva";
  if (code <= 99) return "Tempestade";
  return "—";
}

/** Emoji por weather_code (card sem depender de ícones extras). */
export function weatherCodeEmoji(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 2) return "🌤️";
  if (code === 3) return "☁️";
  if (code <= 48) return "🌫️";
  if (code <= 67) return "🌦️";
  if (code <= 77) return "❄️";
  if (code <= 82) return "🌧️";
  return "⛈️";
}

export async function fetchDestinationWeather(lat: number, lng: number): Promise<DestinationWeather> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m` +
    `&hourly=temperature_2m,precipitation_probability,weather_code` +
    `&daily=sunrise,sunset,uv_index_max,temperature_2m_max,temperature_2m_min` +
    `&timezone=America%2FSao_Paulo&forecast_days=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`weather ${res.status}`);
  const j = await res.json();
  const cur = j.current ?? {};
  const daily = j.daily ?? {};
  const h = j.hourly ?? {};
  const hourly: WeatherHour[] = (h.time ?? []).map((time: string, i: number) => ({
    time,
    tempC: Number(h.temperature_2m?.[i] ?? 0),
    precipProb: Number(h.precipitation_probability?.[i] ?? 0),
    code: Number(h.weather_code?.[i] ?? 0),
  }));
  return {
    tempC: Number(cur.temperature_2m ?? 0),
    feelsLikeC: Number(cur.apparent_temperature ?? 0),
    humidity: Number(cur.relative_humidity_2m ?? 0),
    precipitation: Number(cur.precipitation ?? 0),
    windKmh: Number(cur.wind_speed_10m ?? 0),
    code: Number(cur.weather_code ?? 0),
    uvMax: daily.uv_index_max?.[0] != null ? Number(daily.uv_index_max[0]) : null,
    minC: daily.temperature_2m_min?.[0] != null ? Number(daily.temperature_2m_min[0]) : null,
    maxC: daily.temperature_2m_max?.[0] != null ? Number(daily.temperature_2m_max[0]) : null,
    sunrise: daily.sunrise?.[0] ?? null,
    sunset: daily.sunset?.[0] ?? null,
    hourly,
  };
}
