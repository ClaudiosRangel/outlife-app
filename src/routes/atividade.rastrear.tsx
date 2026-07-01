import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Play, Pause, Square, Trash2, ArrowLeft, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { useActivityTracker } from "@/hooks/use-activity-tracker";
import {
  startActivity,
  updateActivityProgress,
  finishActivity,
  discardActivity,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { StatusBar } from "@/components/StatusBar";
import { Skeleton } from "@/components/ui/skeleton";
import { enqueueActivity } from "@/lib/activity-storage";
import { useActivitySync } from "@/hooks/use-activity-sync";
import { ReviewPromptDialog } from "@/components/ReviewPromptDialog";

const ActivityMap = lazy(() => import("@/components/ActivityMap"));

export const Route = createFileRoute("/atividade/rastrear")({
  component: TrackActivityPage,
  head: () => ({
    meta: [
      { title: "Rastrear atividade — Outlife" },
      { name: "description", content: "Registre sua trilha em tempo real." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/atividade/rastrear" }],
  }),
});

function formatDuration(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

function formatDistance(meters: number) {
  if (meters < 1000) return `${meters.toFixed(0)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

function TrackActivityPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const tracker = useActivityTracker();
  const [activityId, setActivityId] = useState<string | null>(null);
  const [savedActivityId, setSavedActivityId] = useState<string | null>(null);
  const [reviewDestinationId, setReviewDestinationId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const lastSyncRef = useRef(0);
  useActivitySync();

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  const startMut = useMutation({
    mutationFn: () => startActivity(),
    onSuccess: (a) => {
      setActivityId(a.id);
      tracker.start();
      toast.success(t("activity.toasts.started"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const finishMut = useMutation({
    mutationFn: async () => {
      if (!activityId) throw new Error("No activity");
      const result = tracker.finalize();
      if (!result.route) {
        await discardActivity(activityId).catch(() => {});
        throw new Error(t("activity.toasts.tooShort"));
      }
      try {
        return await finishActivity(activityId, {
          distance_meters: result.distance,
          duration_seconds: result.duration,
          route_geojson: result.route,
        });
      } catch (err) {
        // Offline / falha de rede: enfileira em IndexedDB para sincronização posterior.
        await enqueueActivity({
          localId: crypto.randomUUID(),
          remoteId: activityId,
          startTime: new Date(Date.now() - result.duration * 1000).toISOString(),
          endTime: new Date().toISOString(),
          distance_meters: result.distance,
          duration_seconds: result.duration,
          route_geojson: result.route,
        });
        throw new Error(
          err instanceof Error
            ? `${err.message} — atividade salva offline e será sincronizada.`
            : "Atividade salva offline e será sincronizada.",
        );
      }
    },
    onSuccess: (a) => {
      toast.success(t("activity.toasts.saved"));
      tracker.reset();
      setActivityId(null);
      if (a.destination_id) {
        setSavedActivityId(a.id);
        setReviewDestinationId(a.destination_id);
        setReviewOpen(true);
      } else {
        navigate({ to: "/atividade/$activityId", params: { activityId: a.id } });
      }
    },
    onError: (e: Error) => {
      toast.error(e.message);
      tracker.reset();
      setActivityId(null);
    },
  });


  // Sync incremental ao banco a cada 10 pontos
  useEffect(() => {
    if (!activityId) return;
    if (tracker.status !== "tracking") return;
    if (tracker.points.length < 2) return;
    if (tracker.points.length - lastSyncRef.current < 10) return;
    lastSyncRef.current = tracker.points.length;
    const route: GeoJSON.LineString = {
      type: "LineString",
      coordinates: tracker.points.map((p) => [p.lng, p.lat]),
    };
    updateActivityProgress(activityId, {
      distance_meters: tracker.distanceMeters,
      route_geojson: route,
    }).catch(() => { /* silencioso; tentaremos no finish */ });
  }, [tracker.points, tracker.status, tracker.distanceMeters, activityId]);

  const handleDiscard = async () => {
    if (activityId) await discardActivity(activityId).catch(() => {});
    tracker.discard();
    setActivityId(null);
    toast(t("activity.toasts.discarded"));
  };

  const isIdle = tracker.status === "idle";
  const isTracking = tracker.status === "tracking";
  const isPaused = tracker.status === "paused";
  const isSaving = tracker.status === "saving" || startMut.isPending || finishMut.isPending;

  return (
    <div className="flex min-h-screen flex-col pb-6">
      <div className="bg-gradient-forest px-5 pb-4 text-white">
        <StatusBar light />
        <div className="flex items-center justify-between pt-2">
          <Link to="/perfil" className="grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur-md">
            <ArrowLeft size={16} />
          </Link>
          <span className="text-xs font-medium uppercase tracking-widest text-white/70">
            {t("activity.trackTitle")}
          </span>
          <span className="w-9" />
        </div>
      </div>

      {tracker.permissionDenied && (
        <div className="mx-5 mt-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          {t("activity.permissionDenied")}
        </div>
      )}

      <div className="mx-5 mt-3">
        <Suspense fallback={<Skeleton className="h-[320px] w-full rounded-2xl" />}>
          <ActivityMap
            path={tracker.points.map((p) => ({ lat: p.lat, lng: p.lng }))}
            current={tracker.currentPos ? { lat: tracker.currentPos.lat, lng: tracker.currentPos.lng } : null}
            follow={isTracking || isPaused}
            height={320}
          />
        </Suspense>
      </div>

      <div className="mx-5 mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-card p-4 shadow-card text-center">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
            {t("activity.metrics.duration")}
          </div>
          <div className="mt-1 font-display text-2xl font-semibold text-primary tabular-nums">
            {formatDuration(tracker.durationSeconds)}
          </div>
        </div>
        <div className="rounded-2xl bg-card p-4 shadow-card text-center">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
            {t("activity.metrics.distance")}
          </div>
          <div className="mt-1 font-display text-2xl font-semibold text-primary tabular-nums">
            {formatDistance(tracker.distanceMeters)}
          </div>
        </div>
      </div>

      <div className="mx-5 mt-4 flex flex-col gap-2">
        {isIdle && !tracker.hasOrphan && (
          <Button
            size="lg"
            className="h-14 rounded-2xl text-base font-semibold"
            onClick={() => startMut.mutate()}
            disabled={isSaving}
          >
            <Play size={18} /> {t("activity.start")}
          </Button>
        )}

        {tracker.hasOrphan && isIdle && (
          <div className="rounded-2xl border border-border bg-card p-3 text-sm">
            <p className="mb-2 font-medium">{t("activity.orphanFound")}</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={tracker.restoreOrphan}>
                {t("activity.resume")}
              </Button>
              <Button variant="ghost" className="flex-1" onClick={tracker.discard}>
                {t("activity.discard")}
              </Button>
            </div>
          </div>
        )}

        {isTracking && (
          <Button
            variant="secondary"
            size="lg"
            className="h-14 rounded-2xl text-base font-semibold"
            onClick={tracker.pause}
          >
            <Pause size={18} /> {t("activity.pause")}
          </Button>
        )}

        {isPaused && (
          <Button
            size="lg"
            className="h-14 rounded-2xl text-base font-semibold"
            onClick={tracker.resume}
          >
            <Play size={18} /> {t("activity.resume")}
          </Button>
        )}

        {(isTracking || isPaused) && (
          <div className="flex gap-2">
            <Button
              variant="destructive"
              className="flex-1 h-12 rounded-2xl"
              onClick={() => finishMut.mutate()}
              disabled={isSaving}
            >
              <Square size={16} /> {t("activity.finish")}
            </Button>
            <Button
              variant="outline"
              className="flex-1 h-12 rounded-2xl"
              onClick={handleDiscard}
              disabled={isSaving}
            >
              <Trash2 size={16} /> {t("activity.discard")}
            </Button>
          </div>
        )}
      </div>

      {isIdle && !tracker.hasOrphan && (
        <p className="mx-5 mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin size={12} /> {t("activity.hint")}
        </p>
      )}

      {savedActivityId && reviewDestinationId && (
        <ReviewPromptDialog
          open={reviewOpen}
          onOpenChange={(v) => {
            setReviewOpen(v);
            if (!v && savedActivityId) {
              const id = savedActivityId;
              setSavedActivityId(null);
              setReviewDestinationId(null);
              navigate({ to: "/atividade/$activityId", params: { activityId: id } });
            }
          }}
          targetId={reviewDestinationId}
          targetType="destination"
          targetLabel="este destino"
        />
      )}
    </div>
  );
}
