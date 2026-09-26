// Card de clima da tela de destino (Bloco 3, Fase B). Open-Meteo: clima atual +
// previsão horária + badge "Atenção" (situações agravantes). Estilo do print
// (gradiente azul). Silencioso quando o clima não carrega.

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Wind, Droplets, Sunrise, Sunset, Sun, AlertTriangle } from "lucide-react";
import { fetchDestinationWeather, weatherCodeEmoji, weatherCodeLabel } from "@/lib/weather-forecast";
import { deriveWeatherAlerts } from "@/lib/weather-alerts";

function hourLabel(iso: string): string {
  const m = iso.match(/T(\d{2}):/);
  return m ? `${m[1]}h` : "";
}

export default function DestinationWeather({ lat, lng }: { lat: number; lng: number }) {
  const { t } = useTranslation();
  const { data: w, isLoading, isError } = useQuery({
    queryKey: ["destination-weather", lat.toFixed(3), lng.toFixed(3)],
    queryFn: () => fetchDestinationWeather(lat, lng),
    staleTime: 15 * 60 * 1000,
  });

  if (isLoading) {
    return <div className="mx-5 mt-3 h-28 animate-pulse rounded-2xl bg-sky-100 dark:bg-sky-950/30" />;
  }
  if (isError || !w) return null; // silencioso

  // Próximas horas a partir de agora (hora local do device).
  const nowHour = new Date().getHours();
  const next = w.hourly.filter((h) => Number(hourLabel(h.time).replace("h", "")) >= nowHour).slice(0, 7);
  const rows = next.length >= 3 ? next : w.hourly.slice(0, 7);
  const maxProb = Math.max(0, ...rows.map((h) => h.precipProb));
  const alerts = deriveWeatherAlerts({
    code: w.code, windKmh: w.windKmh, uvMax: w.uvMax, precipitation: w.precipitation,
    maxPrecipProbNextHours: maxProb,
  });

  return (
    <div className="mx-5 mt-3 overflow-hidden rounded-2xl bg-gradient-to-br from-sky-400 to-sky-600 p-4 text-white shadow-card">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="text-4xl leading-none">{weatherCodeEmoji(w.code)}</div>
          <div>
            <div className="font-display text-3xl font-bold leading-none">{Math.round(w.tempC)}°C</div>
            <div className="text-xs text-white/85">{weatherCodeLabel(w.code)}</div>
          </div>
        </div>
        {alerts.length > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-orange-500 px-2.5 py-1 text-[11px] font-semibold">
            <AlertTriangle size={12} /> {t("weather.attention", { defaultValue: "Atenção" })}
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/85">
        <span>{t("weather.feelsLike", { defaultValue: "Sensação" })} {Math.round(w.feelsLikeC)}°</span>
        <span className="flex items-center gap-1"><Wind size={12} /> {Math.round(w.windKmh)} km/h</span>
        <span className="flex items-center gap-1"><Droplets size={12} /> {w.humidity}%</span>
        {w.minC != null && w.maxC != null && <span>{Math.round(w.minC)}° / {Math.round(w.maxC)}°</span>}
      </div>

      {/* Previsão horária */}
      <div className="mt-3 flex gap-3 overflow-x-auto scrollbar-hide border-t border-white/20 pt-3">
        {rows.map((h, i) => (
          <div key={h.time} className="flex shrink-0 flex-col items-center gap-1">
            <span className={`text-[10px] ${i === 0 ? "font-bold text-orange-200" : "text-white/70"}`}>
              {i === 0 ? t("weather.now", { defaultValue: "Agora" }) : hourLabel(h.time)}
            </span>
            <span className="text-lg leading-none">{weatherCodeEmoji(h.code)}</span>
            <span className="text-xs font-semibold">{Math.round(h.tempC)}°</span>
          </div>
        ))}
      </div>

      {/* Rodapé: UV + nascer/pôr do sol */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/20 pt-2 text-[11px] text-white/85">
        {w.uvMax != null && <span className="flex items-center gap-1"><Sun size={12} /> UV {Math.round(w.uvMax)}</span>}
        {w.sunrise && <span className="flex items-center gap-1"><Sunrise size={12} /> {hourLabel(w.sunrise)}</span>}
        {w.sunset && <span className="flex items-center gap-1"><Sunset size={12} /> {hourLabel(w.sunset)}</span>}
      </div>
    </div>
  );
}
