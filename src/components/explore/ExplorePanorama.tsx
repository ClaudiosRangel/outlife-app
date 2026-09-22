import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  CloudRain,
  Sun,
  Cloud,
  CloudFog,
  Snowflake,
  Zap,
  Wind,
  Users,
  CalendarDays,
  Store,
  Mountain,
  Trophy,
  MapPin,
} from "lucide-react";
import { fetchWeatherNow, outdoorVerdict, weatherCodeKey, type WeatherNow } from "@/lib/weather";
import type { Panorama } from "@/lib/explore-panorama";

const WEATHER_ICON: Record<string, typeof Sun> = {
  clear: Sun,
  cloudy: Cloud,
  fog: CloudFog,
  rain: CloudRain,
  snow: Snowflake,
  storm: Zap,
};

const VERDICT_STYLE: Record<string, string> = {
  good: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  caution: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  avoid: "bg-red-500/15 text-red-700 dark:text-red-300",
};

/**
 * Cartão "Panorama agora" do Explorar (spec explorar-redesign, fase 2):
 * clima + veredito outdoor + contadores do momento + destaques. O clima vem do
 * Open-Meteo (sem key) e degrada graciosamente se falhar/offline.
 */
export function ExplorePanorama({
  panorama,
  center,
}: {
  panorama: Panorama;
  center: { lat: number; lng: number } | null;
}) {
  const { t } = useTranslation();

  const { data: weather } = useQuery<WeatherNow | null>({
    queryKey: ["weather-now", center?.lat, center?.lng],
    queryFn: () => (center ? fetchWeatherNow(center.lat, center.lng) : Promise.resolve(null)),
    enabled: !!center,
    staleTime: 15 * 60_000,
    retry: 1,
  });

  const c = panorama.counts;
  const h = panorama.highlights;

  const verdict = weather
    ? outdoorVerdict({
        windKmh: weather.windKmh,
        precipProbabilityMax: weather.precipProbabilityMax,
        apparentC: weather.apparentC,
        weatherCode: weather.weatherCode,
      })
    : null;
  const WIcon = weather ? WEATHER_ICON[weatherCodeKey(weather.weatherCode)] ?? Cloud : Cloud;

  return (
    <div className="mx-5 mb-3 rounded-3xl border border-border bg-card p-4 shadow-card">
      <h2 className="mb-2 font-display text-base font-semibold">
        {t("explore.panorama.title", "Agora na sua região")}
      </h2>

      {/* Clima + veredito outdoor */}
      {weather && (
        <div className="mb-3 flex items-center gap-3 rounded-2xl bg-secondary/50 p-3">
          <WIcon size={28} className="shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold leading-none">{weather.temperatureC}°</span>
              <span className="text-xs text-muted-foreground">
                {t("explore.panorama.feels", "sensação")} {weather.apparentC}°
              </span>
            </div>
            <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Wind size={11} /> {weather.windKmh} km/h
              </span>
              {weather.precipProbabilityMax != null && (
                <span className="flex items-center gap-1">
                  <CloudRain size={11} /> {weather.precipProbabilityMax}%
                </span>
              )}
              {weather.tempMinC != null && weather.tempMaxC != null && (
                <span>
                  {weather.tempMinC}° / {weather.tempMaxC}°
                </span>
              )}
            </div>
          </div>
          {verdict && (
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${VERDICT_STYLE[verdict]}`}>
              {t(`explore.panorama.verdict.${verdict}`)}
            </span>
          )}
        </div>
      )}

      {/* Contadores do momento */}
      <div className="grid grid-cols-4 gap-2">
        <Stat icon={Users} value={c.friendsLive} label={t("explore.panorama.friends", "amigos")} />
        <Stat icon={CalendarDays} value={c.eventsUpcoming} label={t("explore.panorama.events", "eventos")} />
        <Stat icon={Store} value={c.partnersNearby} label={t("explore.panorama.partners", "parceiros")} />
        <Stat icon={Mountain} value={c.destinationsNearby + c.trailsNearby} label={t("explore.panorama.places", "lugares")} />
      </div>

      {/* Destaques */}
      {(h.nextEvent || h.nearestFriend || h.topDestination) && (
        <div className="mt-3 space-y-1.5 border-t border-border pt-3 text-xs">
          {h.nearestFriend && (
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-500/15 text-emerald-600">
                <Users size={12} />
              </span>
              <span className="min-w-0 flex-1 truncate">
                <b>{h.nearestFriend.name}</b>{" "}
                {h.nearestFriend.activityType
                  ? t("explore.panorama.friendDoing", { activity: h.nearestFriend.activityType, defaultValue: "em atividade" })
                  : t("explore.panorama.friendActive", "em atividade agora")}
                {h.nearestFriend.distanceKm > 0 ? ` · ${h.nearestFriend.distanceKm} km` : ""}
              </span>
            </div>
          )}
          {h.nextEvent && (
            <Link to="/eventos" className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-amber-500/15 text-amber-600">
                <CalendarDays size={12} />
              </span>
              <span className="min-w-0 flex-1 truncate">
                <b>{t("explore.panorama.nextEvent", "Próximo evento")}:</b> {h.nextEvent.title}
              </span>
            </Link>
          )}
          {h.topDestination && (
            <Link
              to="/destino/$destinationId"
              params={{ destinationId: h.topDestination.id }}
              className="flex items-center gap-2"
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/15 text-primary">
                <Trophy size={12} />
              </span>
              <span className="min-w-0 flex-1 truncate">
                <b>{t("explore.panorama.topDestination", "Destaque")}:</b> {h.topDestination.name}
                {h.topDestination.rating ? ` · ★ ${h.topDestination.rating}` : ""}
              </span>
              <MapPin size={12} className="shrink-0 text-muted-foreground" />
            </Link>
          )}
        </div>
      )}

      {!center && (
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          {t("explore.panorama.shareLocation", "Compartilhe sua localização para ver o panorama da sua região.")}
        </p>
      )}
    </div>
  );
}

function Stat({ icon: Icon, value, label }: { icon: typeof Users; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-secondary/40 py-2">
      <Icon size={16} className="text-primary" />
      <span className="mt-0.5 text-lg font-bold leading-none">{value}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}
