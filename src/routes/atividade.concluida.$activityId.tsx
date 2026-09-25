// Tela comemorativa de atividade concluída (Rodada 3 / design — item de alto
// impacto na retenção). Aparece logo após salvar a atividade: parabéns +
// confete, métricas grandes, streak (dias seguidos), e ações (compartilhar
// story / ver atividade). Full-screen imersiva.

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Trophy, Flame, Share2, ChevronRight, Loader2, Clock, Route as RouteIcon, Mountain } from "lucide-react";
import { StatusBar } from "@/components/StatusBar";
import {
  fetchActivityById,
  fetchActivityTypes,
  fetchMyActivityStreak,
} from "@/lib/api";
import { computeActivityMetrics } from "@/lib/activity-metrics";
import { computeByMetricForm, type MetricForm } from "@/lib/metric-forms";
import { generateActivityStory } from "@/lib/story-generator";
import { shareContent } from "@/lib/share";
import { toast } from "sonner";

export const Route = createFileRoute("/atividade/concluida/$activityId")({
  component: AtividadeConcluida,
  head: () => ({
    meta: [
      { title: "Atividade concluída — OutVitar" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/atividade/concluida" }],
  }),
});

function fmtDuration(s: number | null) {
  if (!s) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

// Confete leve (CSS puro): 40 peças com posição/atraso/cor pseudo-aleatórios.
const CONFETTI = Array.from({ length: 40 }, (_, i) => {
  const colors = ["#f97316", "#16a34a", "#facc15", "#38bdf8", "#ffffff"];
  return {
    left: (i * 97) % 100,
    delay: (i % 10) * 0.15,
    duration: 2.2 + ((i * 7) % 10) / 10,
    color: colors[i % colors.length],
    size: 6 + (i % 4) * 2,
  };
});

function AtividadeConcluida() {
  const { activityId } = Route.useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [sharing, setSharing] = useState(false);

  const { data: activity } = useQuery({
    queryKey: ["activity", activityId],
    queryFn: () => fetchActivityById(activityId),
  });
  const { data: activityTypes } = useQuery({
    queryKey: ["activity-types"],
    queryFn: fetchActivityTypes,
    staleTime: 5 * 60 * 1000,
  });
  const { data: streak = 0 } = useQuery({
    queryKey: ["my-activity-streak"],
    queryFn: fetchMyActivityStreak,
  });

  const catalogType = (activityTypes ?? []).find((tp) => tp.code === activity?.activity_type);
  const metricForm: MetricForm = (catalogType?.metric_form as MetricForm) ?? "speed_elevation";
  const activityName = catalogType?.name ?? activity?.activity_type ?? "";

  const coords =
    activity?.route_geojson?.coordinates?.map((c) => ({ lat: c[1], lng: c[0] })) ?? [];

  const finalMetrics = computeActivityMetrics({
    activityType: activity?.activity_type ?? null,
    distanceMeters: activity?.distance_meters ?? 0,
    durationSeconds: activity?.duration_seconds ?? 0,
  });

  const elev = activity?.elevation_gain;
  const elevLabel =
    typeof elev === "number" && Number.isFinite(elev) && elev > 0 ? `${Math.round(elev)}m` : "—";

  const storyMetrics = useMemo(() => {
    const mf = computeByMetricForm(metricForm, {
      distanceMeters: activity?.distance_meters ?? 0,
      durationSeconds: activity?.duration_seconds ?? 0,
      elevationGain: activity?.elevation_gain ?? null,
    });
    const list = [
      { label: t("activity.metrics.distance"), value: `${((activity?.distance_meters ?? 0) / 1000).toFixed(2)} km` },
      { label: t("activity.metrics.duration"), value: fmtDuration(activity?.duration_seconds ?? null) },
    ];
    if (mf.primary) list.push({ label: mf.primary.label, value: mf.primary.value });
    if (mf.secondary && metricForm === "speed_elevation") list.push({ label: mf.secondary.label, value: mf.secondary.value });
    return list;
  }, [activity, metricForm, t]);

  const handleShare = async () => {
    if (!activity) return;
    setSharing(true);
    try {
      const blob = await generateActivityStory({
        path: coords,
        activityName,
        metrics: storyMetrics,
        backgroundUrl: activity.image_url ?? null,
      });
      const deepLink = `${window.location.origin}/a/${activityId}`;
      await shareContent({
        file: blob,
        fileName: "outvitar-story.webp",
        title: t("activity.shareBannerTitle", { defaultValue: "Minha atividade OutVitar" }),
        text: `${t("activity.shareBannerText", { defaultValue: "Confira minha atividade no OutVitar!" })} ${deepLink}`,
      });
    } catch {
      toast.error(t("activity.shareBannerError", { defaultValue: "Não foi possível gerar a imagem." }));
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-forest text-white">
      <StatusBar light />

      {/* Confete */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {CONFETTI.map((c, i) => (
          <span
            key={i}
            className="absolute top-[-10%] block rounded-sm"
            style={{
              left: `${c.left}%`,
              width: c.size,
              height: c.size * 1.6,
              backgroundColor: c.color,
              animation: `ov-confetti ${c.duration}s linear ${c.delay}s infinite`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes ov-confetti {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(115vh) rotate(720deg); opacity: 0.9; }
        }
      `}</style>

      <div className="relative z-10 flex min-h-screen flex-col px-6 pb-8 pt-[calc(env(safe-area-inset-top,24px)+24px)]">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="grid h-20 w-20 place-items-center rounded-3xl bg-white/15 backdrop-blur">
            <Trophy size={40} className="text-[#facc15]" />
          </div>
          <h1 className="mt-5 font-display text-3xl font-bold leading-tight">
            {t("activityDone.title", { defaultValue: "Atividade concluída!" })}
          </h1>
          {activityName && (
            <p className="mt-1 text-sm font-semibold uppercase tracking-widest text-white/70">{activityName}</p>
          )}

          {/* Streak */}
          {streak > 0 && (
            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 backdrop-blur">
              <Flame size={18} className="text-[#f97316]" />
              <span className="text-sm font-semibold">
                {t("activityDone.streak", { defaultValue: "{{count}} dias seguidos", count: streak })}
              </span>
            </div>
          )}

          {/* Métricas grandes */}
          <div className="mt-8 grid w-full max-w-sm grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/10 p-4 text-center backdrop-blur">
              <RouteIcon size={16} className="mx-auto text-white/70" />
              <div className="mt-1 font-display text-2xl font-bold tabular-nums">
                {((activity?.distance_meters ?? 0) / 1000).toFixed(2)}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-white/60">km</div>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 text-center backdrop-blur">
              <Clock size={16} className="mx-auto text-white/70" />
              <div className="mt-1 font-display text-2xl font-bold tabular-nums">
                {fmtDuration(activity?.duration_seconds ?? null)}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-white/60">{t("activity.metrics.duration")}</div>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 text-center backdrop-blur">
              <div className="mt-1 font-display text-2xl font-bold tabular-nums">
                {finalMetrics.averageSpeedKmh ? `${finalMetrics.averageSpeedKmh}` : "—"}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-white/60">km/h</div>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 text-center backdrop-blur">
              <Mountain size={16} className="mx-auto text-white/70" />
              <div className="mt-1 font-display text-2xl font-bold tabular-nums">{elevLabel}</div>
              <div className="text-[10px] uppercase tracking-widest text-white/60">{t("activity.metrics.elevation")}</div>
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="mt-6 space-y-2">
          <button
            onClick={handleShare}
            disabled={sharing || coords.length < 2}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-sm font-bold text-[var(--forest,#166534)] active:scale-[0.98] disabled:opacity-60"
          >
            {sharing ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />}
            {t("activityDone.share", { defaultValue: "Compartilhar conquista" })}
          </button>
          <Link
            to="/atividade/$activityId"
            params={{ activityId }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white/15 py-3.5 text-sm font-semibold text-white backdrop-blur active:scale-[0.98]"
          >
            {t("activityDone.view", { defaultValue: "Ver atividade" })}
            <ChevronRight size={16} />
          </Link>
          <button
            onClick={() => navigate({ to: "/" })}
            className="w-full py-2 text-sm font-medium text-white/70"
          >
            {t("activityDone.home", { defaultValue: "Voltar ao início" })}
          </button>
        </div>
      </div>
    </div>
  );
}
