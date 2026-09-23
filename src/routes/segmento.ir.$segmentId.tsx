import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronLeft, Navigation, Flag, MapPin, Loader2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { LocationTracking } from "@outlife/capacitor-location-tracking";
import { StatusBar } from "@/components/StatusBar";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchSegmentById } from "@/lib/api";
import { haversineMeters } from "@/lib/haversine";
import type { PluginListenerHandle } from "@capacitor/core";

const SegmentNavMap = lazy(() => import("@/components/SegmentNavMap"));

type LatLng = { lat: number; lng: number };

export const Route = createFileRoute("/segmento/ir/$segmentId")({
  component: NavigateSegmentPage,
  head: () => ({
    meta: [
      { title: "Ir até o segmento — OutVitar" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/segmento/ir" }],
  }),
});

function fmtDist(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;
}

function NavigateSegmentPage() {
  const { segmentId } = Route.useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [userPos, setUserPos] = useState<LatLng | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const nativeListenerRef = useRef<PluginListenerHandle | null>(null);

  const { data: segment, isLoading } = useQuery({
    queryKey: ["segment", segmentId],
    queryFn: () => fetchSegmentById(segmentId),
  });

  const start: LatLng | null =
    segment?.start_lat != null && segment?.start_lng != null
      ? { lat: segment.start_lat, lng: segment.start_lng }
      : null;

  // Posição do usuário ao vivo (GPS). Plugin nativo dentro do shell; Web
  // Geolocation fora dele. Isolado desta tela — não mexe no tracker.
  useEffect(() => {
    let cancelled = false;
    if (Capacitor.isNativePlatform()) {
      void LocationTracking.startTracking({ minIntervalMs: 2000, minDistanceMeters: 2 });
      void LocationTracking.addListener("locationUpdate", (p) => {
        if (cancelled) return;
        setUserPos({ lat: p.lat, lng: p.lng });
      }).then((h) => { nativeListenerRef.current = h; });
      return () => {
        cancelled = true;
        void LocationTracking.stopTracking();
        nativeListenerRef.current?.remove();
        nativeListenerRef.current = null;
      };
    }
    if ("geolocation" in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          if (cancelled) return;
          setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) setPermissionDenied(true);
        },
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 12000 },
      );
      return () => {
        cancelled = true;
        if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      };
    }
  }, []);

  const distToStart =
    userPos && start ? haversineMeters(userPos, start) : null;
  // Considera "chegou" quando está a menos de 25 m do início.
  const arrived = distToStart != null && distToStart <= 25;

  if (isLoading) {
    return (
      <div className="animate-float-up pb-24">
        <StatusBar />
        <div className="mx-5 mt-4 space-y-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-[380px] w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!segment || !start) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <MapPin size={40} className="mb-3 opacity-40" />
        <h1 className="text-lg font-semibold">{t("segments.noStart", "Este segmento não tem ponto de início.")}</h1>
        <button onClick={() => window.history.back()} className="mt-4 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">
          {t("common.back", "Voltar")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col pb-6">
      <div className="bg-gradient-forest px-5 pb-4 text-white">
        <StatusBar light />
        <div className="flex items-center gap-3 pt-2">
          <button onClick={() => window.history.back()} className="grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur-md">
            <ChevronLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-base font-semibold">{segment.name}</div>
            <div className="flex items-center gap-1 text-xs text-white/70">
              <Navigation size={12} /> {t("segments.navigatingTo", "Indo até o início do segmento")}
            </div>
          </div>
        </div>
      </div>

      {permissionDenied && (
        <div className="mx-5 mt-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          {t("activity.permissionDenied")}
        </div>
      )}

      <div className="mx-5 mt-3">
        <Suspense fallback={<Skeleton className="h-[380px] w-full rounded-2xl" />}>
          <SegmentNavMap polyline={segment.polyline} start={start} user={userPos} />
        </Suspense>
      </div>

      {/* Painel de distância / chegada */}
      <div className="mx-5 mt-4 rounded-2xl bg-card p-4 shadow-card">
        {userPos == null ? (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" /> {t("segments.locating", "Localizando você…")}
          </div>
        ) : arrived ? (
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 text-sm font-semibold text-primary">
              <Flag size={16} /> {t("segments.arrived", "Você chegou ao início!")}
            </div>
            <button
              onClick={() => navigate({ to: "/atividade/rastrear" })}
              className="mt-3 w-full rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
            >
              {t("segments.startActivity", "Iniciar atividade")}
            </button>
          </div>
        ) : (
          <div className="text-center">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
              {t("segments.distanceToStart", "Distância até o início")}
            </div>
            <div className="font-display text-4xl font-bold tabular-nums">
              {distToStart != null ? fmtDist(distToStart) : "—"}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t("segments.followGreenLine", "Siga a linha verde até o marcador. O trajeto do segmento está em laranja.")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
