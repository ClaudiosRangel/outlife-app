/**
 * Página intermediária de deep link para atividades compartilhadas.
 * Padrão Strava: link compartilhado → se o app está instalado, abre
 * direto na atividade; se não, mostra preview + botão para baixar.
 *
 * URL: /a/:activityId (curta, para compartilhar via WhatsApp/Instagram)
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mountain, MapPin, Clock, Route as RouteIcon, Share2, Download } from "lucide-react";
import { fetchActivityById, resolveAsset } from "@/lib/api";
import { computeActivityMetrics } from "@/lib/activity-metrics";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/a/$activityId")({
  component: ActivityDeepLinkPage,
  head: ({ params }) => ({
    meta: [
      { title: "Atividade — Outlife" },
      { name: "description", content: "Veja esta atividade no OutLife — A vida não é só trilhar." },
      { property: "og:title", content: "Confira minha atividade no OutLife" },
      { property: "og:description", content: "Rastreamento de atividade outdoor compartilhado via OutLife." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `/a/${params.activityId}` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `/a/${params.activityId}` }],
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

function formatDistance(meters: number | null) {
  if (meters == null) return "—";
  return meters < 1000 ? `${meters.toFixed(0)} m` : `${(meters / 1000).toFixed(2)} km`;
}

function ActivityDeepLinkPage() {
  const { activityId } = Route.useParams();
  const [triedAppOpen, setTriedAppOpen] = useState(false);

  // Busca pública da atividade (sem autenticação — RLS permite SELECT
  // em user_activities para completed activities)
  const { data: activity, isLoading } = useQuery({
    queryKey: ["activity-public", activityId],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_activities" as never)
        .select("*, profile:user_id(full_name, avatar_url)")
        .eq("id", activityId)
        .eq("status", "completed")
        .maybeSingle();
      return data as any;
    },
  });

  const metrics = activity
    ? computeActivityMetrics({
        activityType: activity.activity_type,
        distanceMeters: activity.distance_meters ?? 0,
        durationSeconds: activity.duration_seconds ?? 0,
      })
    : null;

  // Tenta abrir o app via intent (Android App Links)
  useEffect(() => {
    if (triedAppOpen) return;
    setTriedAppOpen(true);

    // Tenta abrir via intent scheme (funciona em Android)
    const intentUrl = `intent://atividade/${activityId}#Intent;scheme=outlife;package=app.outlife.mobile;end`;
    const timeout = setTimeout(() => {
      // Se não abriu em 2s, o app não está instalado — fica na página
    }, 2000);

    // Tenta via universal link primeiro
    window.location.href = intentUrl;
    return () => clearTimeout(timeout);
  }, [activityId, triedAppOpen]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f172a]">
        <div className="animate-pulse text-white">Carregando...</div>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0f172a] text-white px-6 text-center">
        <Mountain size={48} className="mb-4 opacity-50" />
        <h1 className="text-xl font-semibold">Atividade não encontrada</h1>
        <p className="mt-2 text-sm text-white/60">Este link pode ter expirado ou a atividade foi removida.</p>
      </div>
    );
  }

  const authorName = activity.profile?.full_name ?? "Aventureiro";
  const authorAvatar = resolveAsset(activity.profile?.avatar_url);

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-6 pb-4">
        <div className="flex items-center gap-2">
          <Mountain size={20} className="text-green-400" />
          <span className="font-semibold text-lg">OutLife</span>
        </div>
      </div>

      {/* Map snapshot */}
      {activity.map_snapshot_url && (
        <div className="px-5">
          <img
            src={activity.map_snapshot_url}
            alt="Trajeto da atividade"
            className="w-full h-52 rounded-2xl object-cover"
          />
        </div>
      )}

      {/* Author */}
      <div className="px-5 mt-4 flex items-center gap-3">
        <img src={authorAvatar} alt="" className="h-10 w-10 rounded-full object-cover" />
        <div>
          <div className="font-semibold text-sm">{authorName}</div>
          <div className="text-xs text-white/50 capitalize">{activity.activity_type ?? "atividade"}</div>
        </div>
      </div>

      {/* Metrics */}
      <div className="px-5 mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white/10 p-4 text-center">
          <RouteIcon size={16} className="mx-auto text-green-400 mb-1" />
          <div className="text-xl font-bold">{formatDistance(activity.distance_meters)}</div>
          <div className="text-[10px] text-white/50 uppercase">Distância</div>
        </div>
        <div className="rounded-xl bg-white/10 p-4 text-center">
          <Clock size={16} className="mx-auto text-green-400 mb-1" />
          <div className="text-xl font-bold">{formatDuration(activity.duration_seconds)}</div>
          <div className="text-[10px] text-white/50 uppercase">Duração</div>
        </div>
      </div>

      {metrics && (
        <div className="px-5 mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/10 p-3 text-center">
            <div className="text-lg font-bold">{metrics.averageSpeedKmh ?? "—"} km/h</div>
            <div className="text-[10px] text-white/50 uppercase">Velocidade</div>
          </div>
          <div className="rounded-xl bg-white/10 p-3 text-center">
            <div className="text-lg font-bold">{metrics.averagePaceLabel ?? "—"}</div>
            <div className="text-[10px] text-white/50 uppercase">Ritmo</div>
          </div>
        </div>
      )}

      {activity.description && (
        <div className="px-5 mt-4">
          <p className="text-sm text-white/70">{activity.description}</p>
        </div>
      )}

      {/* CTA */}
      <div className="px-5 mt-8 space-y-3">
        <a
          href={`intent://atividade/${activityId}#Intent;scheme=outlife;package=app.outlife.mobile;end`}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-500 py-4 text-base font-semibold text-white"
        >
          <Mountain size={18} /> Abrir no OutLife
        </a>
        <a
          href="https://play.google.com/store/apps/details?id=app.outlife.mobile"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 py-3.5 text-sm font-medium text-white/80"
        >
          <Download size={16} /> Baixar o app
        </a>
      </div>

      {/* Footer */}
      <div className="px-5 mt-10 pb-8 text-center">
        <p className="text-xs text-white/30">OutLife — A vida não é só trilhar</p>
        <p className="text-[10px] text-white/20 mt-1">avidanaoesotrilhar.com.br</p>
      </div>
    </div>
  );
}
