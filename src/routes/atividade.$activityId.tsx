import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock, Route as RouteIcon, Calendar, Share2, Loader2, Mountain } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { fetchActivityById, fetchActivityTypes } from "@/lib/api";
import { StatusBar } from "@/components/StatusBar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { computeActivityMetrics } from "@/lib/activity-metrics";
import { computeByMetricForm, type MetricForm } from "@/lib/metric-forms";
import { generateActivityBanner, type ActivityBannerMetric, type ActivityBannerVariant } from "@/lib/banner-generator";
import { shareContent } from "@/lib/share";

const ActivityMap = lazy(() => import("@/components/ActivityMap"));

export const Route = createFileRoute("/atividade/$activityId")({
  component: ActivityDetailPage,
  head: ({ params }) => ({
    meta: [
      { title: "Atividade — OutVitar" },
      { name: "description", content: "Detalhes da atividade registrada." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: `/atividade/${params.activityId}` }],
  }),
});

function formatDuration(s: number | null) {
  if (!s) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

function formatDistance(m: number | null) {
  if (m == null) return "—";
  return m < 1000 ? `${m.toFixed(0)} m` : `${(m / 1000).toFixed(2)} km`;
}

function ActivityDetailPage() {
  const { t, i18n } = useTranslation();
  const { activityId } = Route.useParams();
  const { data: activity, isLoading } = useQuery({
    queryKey: ["activity", activityId],
    queryFn: () => fetchActivityById(activityId),
  });

  // Catálogo de tipos (Frente D) — usado para resolver icon_key/metric_form/
  // nome do tipo desta atividade ao montar o banner OUTVITAR (Frente E).
  const { data: activityTypes } = useQuery({
    queryKey: ["activity-types"],
    queryFn: fetchActivityTypes,
    staleTime: 5 * 60 * 1000,
  });

  const coords =
    activity?.route_geojson?.coordinates?.map((c) => ({ lat: c[1], lng: c[0] })) ?? [];

  // Requirement 6.2/6.4: exibe o Activity_Map_Snapshot persistido quando
  // disponível e carregável, junto com métricas/descrição/foto; quando
  // ausente/corrompido, o restante da tela continua sendo exibido
  // normalmente, sem mensagem de erro (mapSnapshotLoadFailed controla
  // isso via onError da própria <img>).
  const [mapSnapshotLoadFailed, setMapSnapshotLoadFailed] = useState(false);

  // Requirement 4.6: Average_Speed final sempre exibido, e Average_Pace
  // final também quando o Activity_Type for Caminhada/Pedalada — ambos a
  // partir dos totais persistidos, pela mesma função usada durante o
  // rastreamento em tempo real (computeActivityMetrics).
  const finalMetrics = computeActivityMetrics({
    activityType: activity?.activity_type ?? null,
    distanceMeters: activity?.distance_meters ?? 0,
    durationSeconds: activity?.duration_seconds ?? 0,
  });

  // Requirement 1.2/1.3 (Property P1): o rótulo de Elevation_Gain é sempre
  // "—" OU "<inteiro>m". Para null, <= 0, NaN, Infinity ou não-finitos,
  // exibe "—" (nunca NaN nem "0m" derivado de ausência) — mesmo padrão de
  // fallback "—" já usado nos cards de velocidade/ritmo.
  const elev = activity?.elevation_gain;
  const elevLabel =
    typeof elev === "number" && Number.isFinite(elev) && elev > 0
      ? `${Math.round(elev)}m`
      : "—";

  const [generatingBanner, setGeneratingBanner] = useState(false);
  // Frente E (Req 8): variante do banner — "photo" quando há foto do usuário,
  // senão "map". O usuário pode alternar quando ambos existirem.
  const [bannerVariant, setBannerVariant] = useState<ActivityBannerVariant | null>(null);

  // Requirement 7.1/7.2/7.4/7.5/7.7: gera o Share_Banner_Image (mapa +
  // métricas) e aciona o compartilhamento já existente; exibe indicador de
  // progresso durante a geração; em falha (incluindo timeout), exibe toast
  // de erro reexecutável, sem abrir o compartilhamento com resultado
  // incompleto.
  // Resolve o tipo desta atividade no catálogo (Frente D) para obter
  // icon_key / metric_form / nome. Fallback seguro quando não há catálogo
  // carregado ou o tipo não está cadastrado.
  const catalogType = (activityTypes ?? []).find((tp) => tp.code === activity?.activity_type);
  const metricForm: MetricForm = (catalogType?.metric_form as MetricForm) ?? "speed_elevation";
  const iconKey = catalogType?.icon_key ?? "activity";
  const activityName = catalogType?.name ?? activity?.activity_type ?? "";

  const handleShareBanner = async () => {
    if (!activity) return;
    setGeneratingBanner(true);
    try {
      // Métricas resolvidas pelo metric_form do tipo (Frente D/E): distância
      // sempre + principal (ritmo/velocidade) + secundária (elevação) quando houver.
      const mf = computeByMetricForm(metricForm, {
        distanceMeters: activity.distance_meters ?? 0,
        durationSeconds: activity.duration_seconds ?? 0,
        elevationGain: activity.elevation_gain ?? null,
      });
      const metrics: ActivityBannerMetric[] = [
        {
          label: t("activity.metrics.distance"),
          value: `${((activity.distance_meters ?? 0) / 1000).toFixed(2)} km`,
        },
        {
          label: t("activity.metrics.duration"),
          value: formatDuration(activity.duration_seconds ?? null),
        },
      ];
      if (mf.primary) metrics.push({ label: mf.primary.label, value: mf.primary.value });
      if (mf.secondary && metricForm === "speed_elevation") {
        metrics.push({ label: mf.secondary.label, value: mf.secondary.value });
      }

      // Variante: preferência do usuário; senão foto (se houver) ou mapa.
      const hasPhoto = !!activity.image_url;
      const hasMap = !!activity.map_snapshot_url;
      const variant: ActivityBannerVariant =
        bannerVariant ?? (hasPhoto ? "photo" : "map");
      const backgroundUrl =
        variant === "photo" ? activity.image_url : activity.map_snapshot_url;

      const blob = await generateActivityBanner({
        variant,
        backgroundUrl: backgroundUrl ?? (hasMap ? activity.map_snapshot_url : activity.image_url),
        iconKey,
        activityName,
        description: activity.description,
        defaultDescription: t("activity.bannerDefaultDescription"),
        metrics,
        // Campos legados mantidos para retrocompat/fallback interno:
        mapSnapshotUrl: activity.map_snapshot_url,
        distanceMeters: activity.distance_meters ?? 0,
        durationSeconds: activity.duration_seconds ?? 0,
        averagePaceLabel: finalMetrics.averagePaceLabel,
        averageSpeedLabel: finalMetrics.averageSpeedKmh ? `${finalMetrics.averageSpeedKmh} km/h` : "—",
      });
      // Deep link: compartilha imagem + texto com link (estilo Strava)
      const deepLink = `${window.location.origin}/a/${activityId}`;
      await shareContent({
        file: blob,
        fileName: "outvitar-atividade.webp",
        title: t("activity.shareBannerTitle"),
        text: `${t("activity.shareBannerText")} ${deepLink}`,
      });
    } catch {
      toast.error(t("activity.shareBannerError"));
    } finally {
      setGeneratingBanner(false);
    }
  };

  return (
    <div className="pb-10">
      <div className="bg-gradient-forest px-5 pb-4 text-white">
        <StatusBar light />
        <div className="flex items-center justify-between pt-2">
          <Link to="/perfil" className="grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur-md">
            <ArrowLeft size={16} />
          </Link>
          <span className="text-xs font-medium uppercase tracking-widest text-white/70">
            {t("activity.detailTitle")}
          </span>
          <span className="w-9" />
        </div>
      </div>

      <div className="mx-5 mt-3">
        {isLoading ? (
          <Skeleton className="h-[320px] w-full rounded-2xl" />
        ) : coords.length >= 2 ? (
          <Suspense fallback={<Skeleton className="h-[320px] w-full rounded-2xl" />}>
            <ActivityMap path={coords} showStartEnd height={320} />
          </Suspense>
        ) : (
          <div className="rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground shadow-card">
            {t("activity.noRoute")}
          </div>
        )}
      </div>

      <div className="mx-5 mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-card p-3 shadow-card text-center">
          <Clock size={16} className="mx-auto text-primary" />
          <div className="mt-1 font-display text-base font-semibold tabular-nums">
            {formatDuration(activity?.duration_seconds ?? null)}
          </div>
          <div className="text-[10px] text-muted-foreground">{t("activity.metrics.duration")}</div>
        </div>
        <div className="rounded-2xl bg-card p-3 shadow-card text-center">
          <RouteIcon size={16} className="mx-auto text-primary" />
          <div className="mt-1 font-display text-base font-semibold tabular-nums">
            {formatDistance(activity?.distance_meters ?? null)}
          </div>
          <div className="text-[10px] text-muted-foreground">{t("activity.metrics.distance")}</div>
        </div>
        <div className="rounded-2xl bg-card p-3 shadow-card text-center">
          <Calendar size={16} className="mx-auto text-primary" />
          <div className="mt-1 font-display text-xs font-semibold">
            {activity?.start_time
              ? new Date(activity.start_time).toLocaleDateString(i18n.language)
              : "—"}
          </div>
          <div className="text-[10px] text-muted-foreground">{t("activity.metrics.date")}</div>
        </div>
      </div>

      {!isLoading && activity && (
        <div className="mx-5 mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-card p-3 shadow-card text-center">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
              {t("activity.metrics.speed")}
            </div>
            <div className="mt-1 font-display text-lg font-semibold text-primary tabular-nums">
              {finalMetrics.averageSpeedKmh ? `${finalMetrics.averageSpeedKmh} km/h` : "—"}
            </div>
          </div>
          <div className="rounded-2xl bg-card p-3 shadow-card text-center">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
              {t("activity.metrics.pace")}
            </div>
            <div className="mt-1 font-display text-lg font-semibold text-primary tabular-nums">
              {finalMetrics.averagePaceLabel ?? "—"}
            </div>
          </div>
          {/* Requirement 1.2/1.3: card de Elevação (Elevation_Gain) — exibe
              "<inteiro>m" quando > 0 e "—" quando ausente/zero, nunca NaN. */}
          <div className="col-span-2 rounded-2xl bg-card p-3 shadow-card text-center">
            <Mountain size={16} className="mx-auto text-primary" />
            <div className="mt-1 text-[11px] uppercase tracking-widest text-muted-foreground">
              {t("activity.metrics.elevation")}
            </div>
            <div className="mt-1 font-display text-lg font-semibold text-primary tabular-nums">
              {elevLabel}
            </div>
          </div>
        </div>
      )}

      {/* Requirement 6.2/6.4: Activity_Map_Snapshot, exibido junto com as
          demais métricas/descrição/foto quando presente e carregável;
          quando ausente ou o carregamento falhar, simplesmente não
          renderiza nada aqui, sem mensagem de erro. */}
      {activity?.map_snapshot_url && !mapSnapshotLoadFailed && (
        <div className="mx-5 mt-4">
          <img
            src={activity.map_snapshot_url}
            alt=""
            loading="lazy"
            className="h-48 w-full rounded-2xl object-cover shadow-card"
            onError={() => setMapSnapshotLoadFailed(true)}
          />
        </div>
      )}

      {/* Requirement 7.1/7.4/7.5: ação de compartilhar o Share_Banner_Image
          da atividade, com indicador de progresso durante a geração. */}
      {!isLoading && activity && (
        <div className="mx-5 mt-4">
          {/* Frente E (Req 8): seletor de variante do banner (Foto/Mapa),
              exibido só quando ambos os fundos existem. */}
          {activity.image_url && activity.map_snapshot_url && (
            <div className="mb-2 flex gap-2">
              <Button
                type="button"
                variant={(bannerVariant ?? "photo") === "photo" ? "default" : "outline"}
                className="h-10 flex-1 rounded-2xl text-xs"
                onClick={() => setBannerVariant("photo")}
              >
                {t("activity.bannerVariantPhoto")}
              </Button>
              <Button
                type="button"
                variant={bannerVariant === "map" ? "default" : "outline"}
                className="h-10 flex-1 rounded-2xl text-xs"
                onClick={() => setBannerVariant("map")}
              >
                {t("activity.bannerVariantMap")}
              </Button>
            </div>
          )}
          <Button
            variant="outline"
            className="w-full h-12 rounded-2xl"
            onClick={handleShareBanner}
            disabled={generatingBanner}
          >
            {generatingBanner ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
            {generatingBanner ? t("activity.generatingBanner") : t("activity.shareBanner")}
          </Button>
        </div>
      )}

      {/* Descrição e foto opcionais adicionadas ao finalizar o
          rastreamento (ver `atividade.rastrear.tsx`). Só exibidas quando
          presentes. */}
      {activity?.image_url && (
        <div className="mx-5 mt-4">
          <img
            src={activity.image_url}
            alt=""
            loading="lazy"
            className="h-56 w-full rounded-2xl object-cover shadow-card"
          />
        </div>
      )}
      {activity?.description && (
        <div className="mx-5 mt-4 rounded-2xl bg-card p-4 shadow-card">
          <p className="text-sm leading-relaxed text-foreground/90">{activity.description}</p>
        </div>
      )}
    </div>
  );
}
