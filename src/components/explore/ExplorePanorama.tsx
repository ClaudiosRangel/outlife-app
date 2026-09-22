import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  Sunrise,
  Sunset,
  Moon,
  Gauge,
  Wind as AirIcon,
} from "lucide-react";
import {
  fetchWeatherNow,
  fetchAirQuality,
  outdoorVerdict,
  weatherCodeKey,
  uvLevelKey,
  aqiLevelKey,
  moonPhase,
  type WeatherNow,
  type AirQuality,
} from "@/lib/weather";
import { buildExploreSummary } from "@/lib/explore-summary";
import type { Panorama } from "@/lib/explore-panorama";
import type { NowMarker } from "@/lib/nearby";
import { resolveAsset } from "@/lib/api";
import avatarFallback from "@/assets/avatar-rafael.jpg";

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

type SheetType = "friends" | "events" | "partners" | "places" | null;

/**
 * Cartão "Agora na sua região" do Explorar (fase 3). Clima + qualidade do ar +
 * UV + sol + lua (Open-Meteo, sem key), resumo em linguagem natural, e
 * contadores CLICÁVEIS: 1 item vai direto; vários abrem uma lista.
 */
export function ExplorePanorama({
  panorama,
  center,
  regionName,
  friendMarkers,
  partnerMarkers,
  eventMarkers,
  placeMarkers,
  onOpen,
}: {
  panorama: Panorama;
  center: { lat: number; lng: number } | null;
  regionName?: string | null;
  friendMarkers: NowMarker[];
  partnerMarkers: NowMarker[];
  eventMarkers: NowMarker[];
  placeMarkers: NowMarker[];
  onOpen: (href: string) => void;
}) {
  const { t } = useTranslation();
  const [sheet, setSheet] = useState<SheetType>(null);

  const { data: weather } = useQuery<WeatherNow | null>({
    queryKey: ["weather-now", center?.lat, center?.lng],
    queryFn: () => (center ? fetchWeatherNow(center.lat, center.lng) : Promise.resolve(null)),
    enabled: !!center,
    staleTime: 15 * 60_000,
    retry: 1,
  });
  const { data: air } = useQuery<AirQuality | null>({
    queryKey: ["air-quality", center?.lat, center?.lng],
    queryFn: () => (center ? fetchAirQuality(center.lat, center.lng) : Promise.resolve(null)),
    enabled: !!center,
    staleTime: 30 * 60_000,
    retry: 1,
  });

  const c = panorama.counts;
  const verdict = weather
    ? outdoorVerdict({
        windKmh: weather.windKmh,
        precipProbabilityMax: weather.precipProbabilityMax,
        apparentC: weather.apparentC,
        weatherCode: weather.weatherCode,
      })
    : null;
  const WIcon = weather ? WEATHER_ICON[weatherCodeKey(weather.weatherCode)] ?? Cloud : Cloud;

  const summary = buildExploreSummary({
    regionName,
    temperatureC: weather?.temperatureC ?? null,
    verdict,
    panorama,
  });

  const uvKey = uvLevelKey(weather?.uvIndexMax ?? null);
  const aqiKey = aqiLevelKey(air?.usAqi ?? null);
  const moon = moonPhase(new Date());
  const fmtTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";

  // Abre um contador: 1 item vai direto ao href; vários abrem a lista.
  const openCounter = (type: Exclude<SheetType, null>, markers: NowMarker[]) => {
    if (markers.length === 1 && markers[0].href) {
      onOpen(markers[0].href);
      return;
    }
    if (markers.length > 0) setSheet(type);
  };

  return (
    <div className="mx-5 mb-3 rounded-3xl border border-border bg-card p-4 shadow-card">
      <h2 className="mb-2 font-display text-base font-semibold">
        {regionName
          ? t("explore.panorama.titleRegion", { region: regionName, defaultValue: `Agora em ${regionName}` })
          : t("explore.panorama.title", "Agora na sua região")}
      </h2>

      {/* Resumo em linguagem natural (item 4) */}
      <p className="mb-3 text-sm leading-relaxed text-muted-foreground">{summary}</p>

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
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
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

      {/* Métricas extras: UV, ar, sol, lua (item 1) */}
      {weather && (
        <div className="mb-3 grid grid-cols-4 gap-2 text-center">
          <Metric icon={Sun} label={t("explore.panorama.uv", "UV")} value={weather.uvIndexMax != null ? String(Math.round(weather.uvIndexMax)) : "—"} hint={uvKey ? t(`explore.panorama.uvLevel.${uvKey}`) : undefined} />
          <Metric icon={Gauge} label={t("explore.panorama.air", "Ar")} value={air?.usAqi != null ? String(air.usAqi) : "—"} hint={aqiKey ? t(`explore.panorama.aqiLevel.${aqiKey}`) : undefined} />
          <Metric icon={Sunrise} label={t("explore.panorama.sunrise", "Nascer")} value={fmtTime(weather.sunriseIso)} />
          <Metric icon={Sunset} label={t("explore.panorama.sunset", "Pôr")} value={fmtTime(weather.sunsetIso)} />
        </div>
      )}
      {weather && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl bg-secondary/40 px-3 py-2 text-[11px] text-muted-foreground">
          <Moon size={13} className="text-primary" />
          <span>
            {t("explore.panorama.moon", "Lua")}: {t(`explore.panorama.moonPhase.${moon.key}`)} · {Math.round(moon.illumination * 100)}%
          </span>
        </div>
      )}

      {/* Contadores clicáveis (item 2/ajuste B) */}
      <div className="grid grid-cols-4 gap-2">
        <Stat icon={Users} value={c.friendsLive} label={t("explore.panorama.friends", "amigos")} onClick={() => openCounter("friends", friendMarkers)} />
        <Stat icon={CalendarDays} value={c.eventsUpcoming} label={t("explore.panorama.events", "eventos")} onClick={() => openCounter("events", eventMarkers)} />
        <Stat icon={Store} value={c.partnersNearby} label={t("explore.panorama.partners", "parceiros")} onClick={() => openCounter("partners", partnerMarkers)} />
        <Stat icon={Mountain} value={c.destinationsNearby + c.trailsNearby} label={t("explore.panorama.places", "lugares")} onClick={() => openCounter("places", placeMarkers)} />
      </div>

      {!center && (
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          {t("explore.panorama.shareLocation", "Compartilhe sua localização ou busque uma região para ver o panorama.")}
        </p>
      )}

      {/* Lista (bottom sheet simples) ao clicar num contador com vários itens */}
      {sheet && (
        <MarkerListSheet
          title={t(`explore.panorama.${sheet}`, sheet)}
          markers={
            sheet === "friends" ? friendMarkers
            : sheet === "events" ? eventMarkers
            : sheet === "partners" ? partnerMarkers
            : placeMarkers
          }
          onClose={() => setSheet(null)}
          onOpen={(href) => {
            setSheet(null);
            onOpen(href);
          }}
        />
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value, hint }: { icon: typeof Sun; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-secondary/40 py-2">
      <Icon size={14} className="mx-auto text-primary" />
      <div className="mt-0.5 text-sm font-bold leading-none">{value}</div>
      <div className="text-[9px] text-muted-foreground">{hint ?? label}</div>
    </div>
  );
}

function Stat({ icon: Icon, value, label, onClick }: { icon: typeof Users; value: number; label: string; onClick: () => void }) {
  const disabled = value <= 0;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center rounded-2xl bg-secondary/40 py-2 transition-base ${disabled ? "opacity-60" : "active:scale-95 hover:bg-secondary/70"}`}
    >
      <Icon size={16} className="text-primary" />
      <span className="mt-0.5 text-lg font-bold leading-none">{value}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </button>
  );
}

function MarkerListSheet({
  title,
  markers,
  onClose,
  onOpen,
}: {
  title: string;
  markers: NowMarker[];
  onClose: () => void;
  onOpen: (href: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="max-h-[70vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted" />
        <h3 className="mb-2 font-display text-base font-semibold capitalize">{title}</h3>
        <div className="space-y-1.5">
          {markers.map((m) => (
            <button
              key={m.id}
              onClick={() => m.href && onOpen(m.href)}
              className="flex w-full items-center gap-3 rounded-2xl bg-secondary/40 p-2.5 text-left active:scale-[0.99]"
            >
              {m.kind === "friend" ? (
                <img src={resolveAsset(m.avatarUrl, avatarFallback)} alt="" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary">
                  {m.kind === "partner" ? <Store size={14} /> : m.kind === "event" ? <CalendarDays size={14} /> : <Mountain size={14} />}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{m.title}</span>
                {m.subtitle && <span className="block truncate text-[11px] text-muted-foreground">{m.subtitle}</span>}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
