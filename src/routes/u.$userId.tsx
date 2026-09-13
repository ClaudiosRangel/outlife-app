/**
 * Ponto 3 — Perfil público de outro usuário (aberto ao clicar no nome/autor
 * em posts, comentários, amigos, ranking, etc.). Mostra dados públicos +
 * atividades concluídas + botão de mensagem privada (ponto 4).
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, MessageCircle, Route as RouteIcon, Clock } from "lucide-react";
import { StatusBar } from "@/components/StatusBar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { fetchPublicProfile, fetchUserPublicActivities, resolveAsset } from "@/lib/api";
import avatarFallback from "@/assets/avatar-rafael.jpg";

export const Route = createFileRoute("/u/$userId")({
  component: PublicProfilePage,
  head: () => ({
    meta: [
      { title: "Perfil — OutVitar" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function fmtDuration(s: number | null) {
  if (!s) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}` : `${m}min`;
}
function fmtDistance(m: number | null) {
  if (m == null) return "—";
  return m < 1000 ? `${m.toFixed(0)} m` : `${(m / 1000).toFixed(1)} km`;
}

function PublicProfilePage() {
  const { userId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isSelf = user?.id === userId;

  const { data: profile, isLoading } = useQuery({
    queryKey: ["public-profile", userId],
    queryFn: () => fetchPublicProfile(userId),
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["user-public-activities", userId],
    queryFn: () => fetchUserPublicActivities(userId),
  });

  return (
    <div className="pb-16">
      <div className="bg-gradient-forest px-5 pb-6 text-white">
        <StatusBar light />
        <div className="flex items-center justify-between pt-2">
          <button onClick={() => navigate({ to: "/comunidade" })} className="grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur-md">
            <ArrowLeft size={16} />
          </button>
          <span className="text-xs font-medium uppercase tracking-widest text-white/70">Perfil</span>
          <span className="w-9" />
        </div>

        {isLoading ? (
          <div className="mt-4 flex items-center gap-3">
            <Skeleton className="h-16 w-16 rounded-full" />
            <Skeleton className="h-5 w-40" />
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-3">
            <img src={resolveAsset(profile?.avatar_url, avatarFallback)} alt="" className="h-16 w-16 rounded-full object-cover ring-2 ring-white/30" />
            <div className="min-w-0">
              <h1 className="truncate font-display text-xl font-semibold">{profile?.full_name ?? "Aventureiro"}</h1>
              {profile?.username && <div className="truncate text-sm text-white/70">@{profile.username}</div>}
              <div className="mt-1 flex gap-3 text-xs text-white/70">
                <span>{profile?.followers_count ?? 0} seguidores</span>
                <span>{profile?.following_count ?? 0} seguindo</span>
              </div>
            </div>
          </div>
        )}

        {profile?.description && (
          <p className="mt-3 text-sm text-white/85">{profile.description}</p>
        )}

        {/* Ponto 4: botão de mensagem privada (some no próprio perfil). */}
        {!isSelf && (
          <Button
            className="mt-4 h-11 w-full rounded-2xl bg-white text-primary hover:bg-white/90"
            onClick={() => navigate({ to: "/chat/$userId", params: { userId } })}
          >
            <MessageCircle size={16} /> Enviar mensagem
          </Button>
        )}
      </div>

      <section className="px-5 mt-4">
        <h2 className="font-display text-sm font-semibold text-muted-foreground">Atividades</h2>
        <div className="mt-2 space-y-2">
          {activities.length === 0 ? (
            <div className="rounded-2xl bg-card p-5 text-center text-xs text-muted-foreground shadow-card">
              Nenhuma atividade pública ainda.
            </div>
          ) : (
            activities.map((a) => (
              <Link
                key={a.id}
                to="/atividade/$activityId"
                params={{ activityId: a.id }}
                className="block rounded-2xl bg-card p-3 shadow-card transition-base active:scale-[0.99]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold capitalize">{a.activity_type ?? "atividade"}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {a.start_time ? new Date(a.start_time).toLocaleDateString("pt-BR") : ""}
                  </span>
                </div>
                <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><RouteIcon size={12} /> {fmtDistance(a.distance_meters)}</span>
                  <span className="flex items-center gap-1"><Clock size={12} /> {fmtDuration(a.duration_seconds)}</span>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
