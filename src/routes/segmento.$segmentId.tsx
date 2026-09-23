import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronLeft, Trophy, Route as RouteIcon, Medal, Navigation, Pencil, Globe, Users, Lock } from "lucide-react";
import { StatusBar } from "@/components/StatusBar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchSegmentById,
  fetchSegmentLeaderboard,
  resolveAsset,
  type SegmentVisibility,
} from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import avatarFallback from "@/assets/avatar-rafael.jpg";

const SegmentViewMap = lazy(() => import("@/components/SegmentViewMap"));

function visibilityBadge(v: SegmentVisibility | undefined, t: (k: string, d?: string) => string) {
  if (v === "private") return { Icon: Lock, label: t("segments.visibility.private", "Só eu") };
  if (v === "friends") return { Icon: Users, label: t("segments.visibility.friends", "Amigos") };
  return { Icon: Globe, label: t("segments.visibility.public", "Público") };
}

export const Route = createFileRoute("/segmento/$segmentId")({
  component: SegmentDetailPage,
  head: ({ params }) => ({
    meta: [
      { title: "Segmento — OutVitar" },
      { name: "description", content: "Ranking do segmento." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: `/segmento/${params.segmentId}` }],
  }),
});

function fmtTime(s: number): string {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.round(s % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

function SegmentDetailPage() {
  const { segmentId } = Route.useParams();
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: segment, isLoading } = useQuery({
    queryKey: ["segment", segmentId],
    queryFn: () => fetchSegmentById(segmentId),
  });

  const { data: leaderboard = [] } = useQuery({
    queryKey: ["segment-leaderboard", segmentId],
    queryFn: () => fetchSegmentLeaderboard(segmentId, 10),
  });

  if (isLoading) {
    return (
      <div className="animate-float-up pb-24">
        <StatusBar />
        <div className="px-5 mt-4 space-y-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!segment) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <RouteIcon size={48} className="mb-4 opacity-40" />
        <h1 className="text-xl font-semibold">{t("segments.notFound", "Segmento não encontrado")}</h1>
        <Link to="/explorar" className="mt-6 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">
          {t("common.back", "Voltar")}
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-float-up pb-24">
      <StatusBar />
      <div className="flex items-center gap-3 px-5 pt-2">
        <button onClick={() => window.history.back()} className="grid h-9 w-9 place-items-center rounded-full bg-muted">
          <ChevronLeft size={18} />
        </button>
        <h1 className="flex-1 truncate font-display text-lg font-semibold">{segment.name}</h1>
      </div>

      {/* Cabeçalho do segmento */}
      <div className="mx-5 mt-4 rounded-2xl bg-gradient-forest p-4 text-white">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <RouteIcon size={16} />
            {(segment.distance_meters / 1000).toFixed(2)} km
            {segment.activity_type ? ` · ${t(`activity.activityTypes.${segment.activity_type}`, { defaultValue: segment.activity_type })}` : ""}
          </div>
          {(() => {
            const vb = visibilityBadge(segment.visibility, t);
            return (
              <span className="flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium">
                <vb.Icon size={12} /> {vb.label}
              </span>
            );
          })()}
        </div>
        <div className="mt-1 text-xs text-white/70">
          {t("segments.leaderboardTitle", "Ranking — 10 melhores tempos")}
        </div>
      </div>

      {/* Item 3: mapa do trecho marcado */}
      {(segment.polyline?.length ?? 0) >= 2 || (segment.start_lat != null && segment.end_lat != null) ? (
        <div className="mx-5 mt-4">
          <Suspense fallback={<Skeleton className="h-[260px] w-full rounded-2xl" />}>
            <SegmentViewMap
              polyline={segment.polyline}
              start={segment.start_lat != null && segment.start_lng != null ? { lat: segment.start_lat, lng: segment.start_lng } : null}
              end={segment.end_lat != null && segment.end_lng != null ? { lat: segment.end_lat, lng: segment.end_lng } : null}
            />
          </Suspense>
        </div>
      ) : null}

      {/* Ações: me leve até lá (item 4) + editar (dono, item 3) */}
      <div className="mx-5 mt-3 flex gap-2">
        {segment.start_lat != null && segment.start_lng != null && (
          <button
            onClick={() => navigate({ to: "/segmento/ir/$segmentId", params: { segmentId } })}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground active:scale-[0.99]"
          >
            <Navigation size={16} /> {t("segments.navigate", "Me leve até lá")}
          </button>
        )}
        {segment.created_by === user?.id && (
          <button
            onClick={() => navigate({ to: "/segmento/editar/$segmentId", params: { segmentId } })}
            className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold active:scale-[0.99]"
          >
            <Pencil size={16} /> {t("segments.edit", "Editar")}
          </button>
        )}
      </div>

      {/* Ranking */}
      <div className="mx-5 mt-4 space-y-2">
        {leaderboard.length === 0 ? (
          <div className="rounded-2xl bg-card p-6 text-center text-xs text-muted-foreground shadow-card">
            {t("segments.empty", "Ninguém percorreu este segmento ainda. Seja o primeiro!")}
          </div>
        ) : (
          leaderboard.map((row, i) => {
            const isMe = row.userId === user?.id;
            return (
              <div
                key={row.userId}
                className={`flex items-center gap-3 rounded-2xl p-3 shadow-card ${
                  isMe ? "bg-primary/10 ring-1 ring-primary" : "bg-card"
                }`}
              >
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold">
                  {i === 0 ? <Trophy size={14} className="text-[var(--sun)]" /> : i + 1}
                </div>
                <Link to="/u/$userId" params={{ userId: row.userId }} className="flex min-w-0 flex-1 items-center gap-2">
                  <img
                    src={resolveAsset(row.avatarUrl, avatarFallback)}
                    alt={row.fullName ?? ""}
                    className="h-8 w-8 rounded-full object-cover"
                    loading="lazy"
                  />
                  <span className="truncate text-sm font-medium">
                    {row.fullName ?? t("friends.placeholderName", "Aventureiro")}
                  </span>
                </Link>
                <span className="flex items-center gap-1 text-sm font-bold">
                  {i < 3 && <Medal size={13} className="text-[var(--sun)]" />}
                  {fmtTime(row.bestSeconds)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
