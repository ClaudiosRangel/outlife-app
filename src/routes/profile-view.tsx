/**
 * ProfileView — componente compartilhado do PERFIL UNIFICADO (spec
 * perfil-publico-redesign). Renderiza tanto o Perfil_Próprio (`/perfil`,
 * viewedUserId = usuário logado) quanto o Perfil_De_Outro (`/u/$userId`),
 * com visual moderno estilo Instagram/Strava: hero com anel "AO VIVO",
 * barra de estatísticas, faixa de conquistas e abas com ícones.
 *
 * As seções exclusivas do dono (editar, configurações, admin, parceiro,
 * rastrear, dark mode, nível, checklist, próxima aventura) NÃO ficam aqui —
 * continuam em `perfil.tsx`, que renderiza este componente no topo e
 * complementa abaixo quando isSelf.
 */
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Activity as ActivityIcon,
  Award,
  Clock,
  Grid3x3,
  MapPin,
  MessageCircle,
  Radio,
  Route as RouteIcon,
  Trophy,
  Crown,
  Medal,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchPublicProfile,
  fetchUserPublicActivities,
  fetchUserPostsByAuthor,
  fetchUserAchievements,
  fetchLiveActivityFriends,
  fetchMySegmentTrophies,
  resolveAsset,
  safeCount,
  type UserPostSummary,
  type SegmentTrophy,
} from "@/lib/api";
import { getActivityIcon } from "@/lib/activity-icons";
import { Skeleton } from "@/components/ui/skeleton";
import avatarFallback from "@/assets/avatar-rafael.jpg";
import community1 from "@/assets/community-1.jpg";

type ProfileTab = "atividades" | "posts" | "conquistas";

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

export function ProfileView({ viewedUserId }: { viewedUserId: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isSelf = !!user && user.id === viewedUserId;
  const [tab, setTab] = useState<ProfileTab>("atividades");

  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ["public-profile", viewedUserId],
    queryFn: () => fetchPublicProfile(viewedUserId),
  });

  const { data: activities = [], isLoading: loadingActs } = useQuery({
    queryKey: ["user-public-activities", viewedUserId],
    queryFn: () => fetchUserPublicActivities(viewedUserId),
  });

  const { data: posts = [] } = useQuery({
    queryKey: ["user-posts-by-author", viewedUserId],
    queryFn: () => fetchUserPostsByAuthor(viewedUserId),
  });

  // Conquistas: achievement_records tem RLS de leitura própria — só carrega
  // com dado real no próprio perfil; no de outro, vem vazio (estado vazio).
  const { data: achievements = [] } = useQuery({
    queryKey: ["achievements", viewedUserId],
    queryFn: () => fetchUserAchievements(viewedUserId),
    enabled: isSelf,
  });

  // TASK 2: troféus de segmento (Rei/KOM + posições top 10). A RPC usa
  // auth.uid(), então só faz sentido no próprio perfil.
  const { data: segmentTrophies = [] } = useQuery({
    queryKey: ["my-segment-trophies", viewedUserId],
    queryFn: () => fetchMySegmentTrophies(10),
    enabled: isSelf,
  });

  // Selo ao vivo: cruza a fonte Live por id === viewedUserId && is_live.
  const { data: liveFriends = [] } = useQuery({
    queryKey: ["shared-locations"],
    queryFn: fetchLiveActivityFriends,
    enabled: !!user,
    refetchInterval: 60_000,
  });
  const liveEntry = liveFriends.find((f) => f.id === viewedUserId && f.is_live);
  const isLive = !!liveEntry;

  const statActivities = safeCount(activities.length);
  const statFollowers = safeCount(profile?.followers_count);
  const statFollowing = safeCount(profile?.following_count);

  const tabs: { key: ProfileTab; icon: typeof Grid3x3; label: string }[] = [
    { key: "atividades", icon: RouteIcon, label: t("profileView.tabActivities", "Atividades") },
    { key: "posts", icon: Grid3x3, label: t("profileView.tabPosts", "Posts") },
    { key: "conquistas", icon: Trophy, label: t("profileView.tabAchievements", "Conquistas") },
  ];

  return (
    <div>
      {/* HERO */}
      <div className="relative bg-gradient-forest px-5 pb-6 pt-2 text-white">
        <div className="flex items-start gap-4">
          {/* Avatar com anel AO VIVO */}
          <div className="relative shrink-0">
            <div
              className={
                isLive
                  ? "rounded-full bg-gradient-to-tr from-[var(--sun)] to-red-500 p-[3px]"
                  : "rounded-full p-[3px] ring-2 ring-white/20"
              }
            >
              <img
                src={resolveAsset(profile?.avatar_url, avatarFallback)}
                alt={profile?.full_name ?? ""}
                className="h-20 w-20 rounded-full border-2 border-[var(--forest-deep)] object-cover"
              />
            </div>
            {isLive && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-red-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide">
                {t("profileView.live", "AO VIVO")}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            {loadingProfile ? (
              <div className="space-y-2 pt-1">
                <Skeleton className="h-5 w-40 bg-white/20" />
                <Skeleton className="h-3 w-24 bg-white/20" />
              </div>
            ) : (
              <>
                <h1 className="truncate font-display text-xl font-semibold">
                  {profile?.full_name ?? t("friends.placeholderName", "Aventureiro")}
                </h1>
                {profile?.username && (
                  <div className="truncate text-sm text-white/70">@{profile.username}</div>
                )}
                {/* Stats inline estilo Instagram */}
                <div className="mt-2 flex gap-4 text-xs">
                  <span><b className="text-sm">{statActivities}</b> {t("profileView.activities", "atividades")}</span>
                  <span><b className="text-sm">{statFollowers}</b> {t("profile.followers", "seguidores")}</span>
                  <span><b className="text-sm">{statFollowing}</b> {t("profile.following", "seguindo")}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {profile?.bio && (
          <p className="mt-3 text-sm font-medium italic leading-relaxed text-white">
            {profile.bio}
          </p>
        )}
        {profile?.description && (
          <p className="mt-2 text-sm leading-relaxed text-white/90">{profile.description}</p>
        )}

        {/* Selo textual ao vivo (toque leva ao mapa/Explorar) */}
        {isLive && (
          <button
            onClick={() => navigate({ to: "/explorar" })}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-white/15 py-2.5 text-sm font-semibold backdrop-blur-md"
          >
            <Radio size={16} className="animate-pulse" />
            {t("profileView.liveNow", "Em atividade agora")}
            {liveEntry?.activity_type ? ` · ${t(`activity.activityTypes.${liveEntry.activity_type}`, { defaultValue: liveEntry.activity_type })}` : ""}
          </button>
        )}

        {/* Ação principal — só no perfil de outro */}
        {!isSelf && (
          <button
            onClick={() => navigate({ to: "/chat/$userId", params: { userId: viewedUserId } })}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3 text-sm font-semibold text-primary"
          >
            <MessageCircle size={16} /> {t("profileView.message", "Enviar mensagem")}
          </button>
        )}
      </div>

      {/* Faixa de conquistas (carrossel) */}
      {achievements.length > 0 && (
        <div className="px-5 pt-4">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
            <Award size={14} className="text-primary" /> {t("profile.achievements", "Conquistas")}
          </div>
          <div className="mt-2 flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {achievements.map((a) => (
              <div key={a.id} className="flex min-w-16 flex-col items-center gap-1 rounded-2xl bg-card p-2 shadow-card">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--sun)]/15 text-[var(--earth)]">
                  <Award size={16} />
                </span>
                <span className="max-w-16 truncate text-center text-[9px] font-medium">{a.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Abas com ícones */}
      <div className="mt-4 flex border-b border-border px-5">
        {tabs.map((tb) => {
          const Icon = tb.icon;
          const active = tab === tb.key;
          return (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 pb-2 pt-1 text-xs font-semibold transition-base ${
                active ? "border-primary text-primary" : "border-transparent text-muted-foreground"
              }`}
            >
              <Icon size={16} /> {tb.label}
            </button>
          );
        })}
      </div>

      {/* Conteúdo das abas */}
      <div className="px-5 pt-3 pb-8">
        {tab === "atividades" && (
          <ActivitiesTab activities={activities} loading={loadingActs} />
        )}
        {tab === "posts" && <PostsTab posts={posts} onOpen={(p) => {
          if (p.activity_id) navigate({ to: "/atividade/$activityId", params: { activityId: p.activity_id } });
          else navigate({ to: "/comunidade" });
        }} />}
        {tab === "conquistas" && (
          <AchievementsTab
            achievements={achievements}
            trophies={segmentTrophies}
            onOpenTrophy={(tr) => {
              if (tr.activityId) navigate({ to: "/atividade/$activityId", params: { activityId: tr.activityId } });
              else navigate({ to: "/segmento/$segmentId", params: { segmentId: tr.segmentId } });
            }}
          />
        )}
      </div>
    </div>
  );
}

function ActivitiesTab({
  activities,
  loading,
}: {
  activities: Awaited<ReturnType<typeof fetchUserPublicActivities>>;
  loading: boolean;
}) {
  const { t } = useTranslation();
  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
      </div>
    );
  }
  if (activities.length === 0) {
    return (
      <div className="rounded-2xl bg-card p-6 text-center text-xs text-muted-foreground shadow-card">
        {t("profileView.emptyActivities", "Nenhuma atividade ainda.")}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {activities.map((a) => {
        // Ponto: SEMPRE ícone do tipo de atividade (Icon_Model_Set).
        const iconKey = ACTIVITY_TYPE_TO_ICON[a.activity_type ?? "outro"] ?? "activity";
        const { Icon, color } = getActivityIcon(iconKey);
        return (
          <Link
            key={a.id}
            to="/atividade/$activityId"
            params={{ activityId: a.id }}
            className="block rounded-2xl bg-card p-3 shadow-card transition-base active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10" style={{ color }}>
                <Icon size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold capitalize">
                    {t(`activity.activityTypes.${a.activity_type ?? "outro"}`, { defaultValue: a.activity_type ?? "Atividade" })}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {a.start_time ? new Date(a.start_time).toLocaleDateString("pt-BR") : ""}
                  </span>
                </div>
                <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><RouteIcon size={12} /> {fmtDistance(a.distance_meters)}</span>
                  <span className="flex items-center gap-1"><Clock size={12} /> {fmtDuration(a.duration_seconds)}</span>
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function PostsTab({ posts, onOpen }: { posts: UserPostSummary[]; onOpen: (p: UserPostSummary) => void }) {
  const { t } = useTranslation();
  if (posts.length === 0) {
    return (
      <div className="rounded-2xl bg-card p-6 text-center text-xs text-muted-foreground shadow-card">
        {t("profileView.emptyPosts", "Nenhuma publicação ainda.")}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-1">
      {posts.map((p) => (
        <button
          key={p.id}
          onClick={() => onOpen(p)}
          className="relative aspect-square overflow-hidden rounded-lg bg-muted"
        >
          <img
            src={resolveAsset(p.image_url, community1)}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
          {p.video_url && (
            <span className="absolute right-1 top-1 rounded bg-black/50 px-1 text-[8px] font-bold text-white">▶</span>
          )}
        </button>
      ))}
    </div>
  );
}

// Formata o tempo do esforço de segmento (mm:ss ou h:mm:ss).
function fmtEffort(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

// Visual do troféu por posição no ranking do segmento (estilo Strava).
function trophyStyle(rank: number): { Icon: typeof Crown; ring: string; color: string; label: string } {
  if (rank === 1) return { Icon: Crown, ring: "bg-[var(--sun)]/20", color: "#d4a017", label: "KOM" };
  if (rank === 2) return { Icon: Medal, ring: "bg-slate-300/30", color: "#9ca3af", label: "2º" };
  if (rank === 3) return { Icon: Medal, ring: "bg-amber-700/20", color: "#b45309", label: "3º" };
  return { Icon: Trophy, ring: "bg-primary/10", color: "hsl(var(--primary))", label: `${rank}º` };
}

function AchievementsTab({
  achievements,
  trophies,
  onOpenTrophy,
}: {
  achievements: { id: string; label: string }[];
  trophies: SegmentTrophy[];
  onOpenTrophy: (tr: SegmentTrophy) => void;
}) {
  const { t } = useTranslation();
  const isEmpty = achievements.length === 0 && trophies.length === 0;
  if (isEmpty) {
    return (
      <div className="rounded-2xl bg-card p-6 text-center text-xs text-muted-foreground shadow-card">
        {t("profileView.emptyAchievements", "Nenhuma conquista ainda.")}
      </div>
    );
  }
  return (
    <div className="space-y-5">
      {/* TASK 2: Troféus de segmento (KOM/posição top 10). */}
      {trophies.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <Trophy size={15} className="text-[var(--sun)]" />
            {t("segments.trophiesTitle", "Troféus de segmento")}
          </h3>
          <div className="space-y-2">
            {trophies.map((tr) => {
              const st = trophyStyle(tr.rank);
              return (
                <button
                  key={tr.segmentId}
                  onClick={() => onOpenTrophy(tr)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-card p-3 text-left shadow-card transition-base active:scale-[0.99]"
                >
                  <span className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-full ${st.ring}`} style={{ color: st.color }}>
                    <st.Icon size={20} />
                    <span className="absolute -bottom-1 rounded-full bg-background px-1 text-[9px] font-bold" style={{ color: st.color }}>
                      {st.label}
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{tr.segmentName}</div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        {tr.rank === 1 ? (
                          <span className="font-semibold text-[var(--sun)]">
                            {t("segments.king", "Rei do segmento")}
                          </span>
                        ) : (
                          t("segments.rankOf", { rank: tr.rank, total: tr.totalAthletes, defaultValue: "{{rank}}º de {{total}}" })
                        )}
                      </span>
                      <span className="flex items-center gap-1"><Clock size={11} /> {fmtEffort(tr.bestSeconds)}</span>
                      <span className="flex items-center gap-1"><RouteIcon size={11} /> {fmtDistance(tr.distanceMeters)}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Conquistas gerais (badges). */}
      {achievements.length > 0 && (
        <section>
          {trophies.length > 0 && (
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <Award size={15} className="text-[var(--earth)]" />
              {t("profileView.badgesTitle", "Conquistas")}
            </h3>
          )}
          <div className="grid grid-cols-4 gap-2">
            {achievements.map((a) => (
              <div key={a.id} className="flex flex-col items-center gap-1 rounded-2xl bg-card p-3 shadow-card">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--sun)]/15 text-[var(--earth)]">
                  <Award size={18} />
                </span>
                <span className="text-center text-[10px] font-medium">{a.label}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// activity_type (enum de user_activities) → icon_key do Icon_Model_Set.
const ACTIVITY_TYPE_TO_ICON: Record<string, string> = {
  corrida: "run",
  caminhada: "walk",
  trilha: "trail",
  pedalada: "bike",
  natacao: "swim",
  remo: "row",
  escalada: "climb",
  voo_livre: "flight",
  surf: "surf",
  skate: "skate",
  outro: "activity",
};
