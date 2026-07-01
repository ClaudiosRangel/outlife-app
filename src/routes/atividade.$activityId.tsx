import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock, Route as RouteIcon, Calendar } from "lucide-react";
import { useTranslation } from "react-i18next";
import { fetchActivityById } from "@/lib/api";
import { StatusBar } from "@/components/StatusBar";
import { Skeleton } from "@/components/ui/skeleton";

const ActivityMap = lazy(() => import("@/components/ActivityMap"));

export const Route = createFileRoute("/atividade/$activityId")({
  component: ActivityDetailPage,
  head: ({ params }) => ({
    meta: [
      { title: "Atividade — Outlife" },
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

  const coords =
    activity?.route_geojson?.coordinates?.map((c) => ({ lat: c[1], lng: c[0] })) ?? [];

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
    </div>
  );
}
