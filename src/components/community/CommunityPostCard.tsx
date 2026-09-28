import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Heart, MessageCircle, Share2, MapPin, Trash2, Trophy, Crown, Medal, Award, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SafeImage } from "@/components/SafeImage";
import { MediaCarousel } from "@/components/community/MediaCarousel";
import { LikeAvatars } from "@/components/community/LikeAvatars";
import { buildCardMedia } from "@/lib/community-card";
import { communityCategoryTranslationKey } from "@/lib/community-category-label";
import { getActivityIcon } from "@/lib/activity-icons";
import { computeByMetricForm, type MetricForm } from "@/lib/metric-forms";
import type { PostLikeAvatar } from "@/lib/api";
import community1 from "@/assets/community-1.jpg";

// Mapa tipo de atividade → icon_key (mesmo do profile-view/comunidade).
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

const CATEGORY_TO_ICON_KEY: Record<string, string> = {
  trilha: "trail",
  caminhada: "walk",
  pedalada: "bike",
  camping: "activity",
  relato: "activity",
  outro: "activity",
};

export type CardActivity = {
  activityType: string | null;
  distanceMeters: number | null;
  durationSeconds: number | null;
  elevationGain: number | null;
  mapSnapshotUrl: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  description: string | null;
  startTime: string | null;
};

export type CommunityCardPost = {
  id: string;
  authorId: string;
  user: string;
  handle: string;
  avatar: string;
  time: string;
  place: string;
  text: string;
  img: string;
  realImg: string | null;
  videoUrl?: string | null;
  category: string;
  likes: number;
  comments: number;
  liked?: boolean;
  following?: boolean;
  activityId?: string | null;
  activity?: CardActivity | null;
  /** Troféu de segmento conquistado nesta atividade (KOM/top-10, estilo Strava). */
  segmentTrophy?: {
    bestRank: number;
    segmentId: string;
    segmentName: string | null;
    avgSpeedKmh: number;
    trophyCount: number;
  } | null;
};

/** Métrica resolvida do tipo de atividade (metric_form + nome legível). */
export type ActivityTypeMeta = { metricForm: MetricForm; iconKey: string; name: string };

function fmtDuration(s: number): string {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.round(s % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export function CommunityPostCard({
  post,
  currentUserId,
  likeAvatars,
  activityMeta,
  onToggleLike,
  onToggleFollow,
  onShare,
  onDelete,
  onToggleComments,
  onOpenActivity,
  showCommentsButton,
  commentsExpanded,
  commentsNode,
}: {
  post: CommunityCardPost;
  currentUserId?: string;
  likeAvatars: PostLikeAvatar[];
  activityMeta?: ActivityTypeMeta | null;
  onToggleLike: (id: string) => void;
  onToggleFollow: (id: string, authorId: string) => void;
  onShare: (post: CommunityCardPost) => void;
  onDelete: (id: string) => void;
  onToggleComments: (id: string) => void;
  onOpenActivity?: (activityId: string) => void;
  showCommentsButton: boolean;
  commentsExpanded: boolean;
  commentsNode?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const act = post.activity ?? null;
  const isActivity = !!post.activityId && !!act;

  // Microrrecompensa: anima o coração (pop + partículas) só ao CURTIR (não ao
  // descurtir). `burst` dispara a animação e se limpa sozinho.
  const [burst, setBurst] = useState(false);
  const handleLikeClick = () => {
    if (!post.liked) {
      setBurst(true);
      window.setTimeout(() => setBurst(false), 700);
    }
    onToggleLike(post.id);
  };

  // Ícone do topo: por tipo de atividade (post de atividade) ou por categoria.
  const iconKey = isActivity
    ? ACTIVITY_TYPE_TO_ICON[act!.activityType ?? "outro"] ?? "activity"
    : CATEGORY_TO_ICON_KEY[post.category] ?? "activity";
  const { Icon } = getActivityIcon(iconKey);
  const TopIcon = Icon as LucideIcon;

  // Métricas por metric_form (Req 3). `trophy` marca a métrica de Conquistas
  // (KOM/segmentos) para receber o ícone dourado de louros na exibição.
  const metrics: { label: string; value: string; trophy?: boolean }[] = [];
  if (isActivity) {
    const mf = computeByMetricForm(activityMeta?.metricForm ?? "speed_elevation", {
      distanceMeters: act!.distanceMeters ?? 0,
      durationSeconds: act!.durationSeconds ?? 0,
      elevationGain: act!.elevationGain ?? null,
    });
    metrics.push({
      label: t("activity.metrics.distance", "Distância"),
      value: `${(((act!.distanceMeters ?? 0)) / 1000).toFixed(2)} km`,
    });
    metrics.push({
      label: t("activity.metrics.duration", "Tempo"),
      value: fmtDuration(act!.durationSeconds ?? 0),
    });
    if (mf.primary) metrics.push({ label: mf.primary.label, value: mf.primary.value });
    if (mf.secondary && (activityMeta?.metricForm ?? "speed_elevation") === "speed_elevation") {
      metrics.push({ label: mf.secondary.label, value: mf.secondary.value });
    }
    // Conquistas de segmento (KOM/top-10) como métrica destacada, estilo Strava.
    if (post.segmentTrophy && post.segmentTrophy.trophyCount > 0) {
      metrics.push({
        label: t("community.achievementsMetric", { defaultValue: "Conquistas" }),
        value: String(post.segmentTrophy.trophyCount),
        trophy: true,
      });
    }
  }

  // Mídias do carrossel (mapa → foto → vídeo).
  const media = buildCardMedia({
    mapSnapshotUrl: isActivity ? act!.mapSnapshotUrl : null,
    imageUrl: post.realImg ?? (isActivity ? act!.imageUrl : null),
    videoUrl: post.videoUrl ?? (isActivity ? act!.videoUrl : null),
  });
  const poster = post.realImg ?? (isActivity ? act!.mapSnapshotUrl ?? undefined : undefined) ?? undefined;

  const description = post.text || (isActivity ? act!.description ?? "" : "");

  return (
    <article className="overflow-hidden rounded-3xl bg-card shadow-card">
      {/* Cabeçalho: autor + contexto (ícone/atividade/data/cidade) */}
      <header className="flex items-center gap-3 p-4">
        <Link
          to="/u/$userId"
          params={{ userId: post.authorId }}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <img src={post.avatar} alt={post.user} loading="lazy" className="h-10 w-10 rounded-full object-cover" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold leading-tight">{post.user}</div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <TopIcon size={12} className="text-primary" aria-hidden />
              {activityMeta?.name && isActivity ? <span>{activityMeta.name}</span> : null}
              <MapPin size={10} /> {post.place} · {post.time}
            </div>
          </div>
        </Link>
        {post.authorId !== currentUserId && (
          <button
            onClick={() => onToggleFollow(post.id, post.authorId)}
            className={`rounded-full px-2 py-0.5 text-xs font-semibold transition-base ${
              post.following ? "bg-secondary text-foreground/60" : "text-primary"
            }`}
          >
            {post.following ? t("community.following") : t("community.follow")}
          </button>
        )}
        {post.authorId === currentUserId && (
          <button
            onClick={() => onDelete(post.id)}
            aria-label={t("community.deletePost")}
            className="ml-2 shrink-0 text-muted-foreground transition-base hover:text-destructive"
          >
            <Trash2 size={16} />
          </button>
        )}
      </header>

      {/* Descrição destacada (Req 2) */}
      {description && (
        <div className="px-4 pb-2">
          <p className="text-base font-semibold leading-snug">{description}</p>
        </div>
      )}

      {/* Métricas da atividade (Req 3) */}
      {isActivity && metrics.length > 0 && (
        <div className="flex flex-wrap gap-x-6 gap-y-2 px-4 pb-3">
          {metrics.map((m) => (
            <div key={m.label}>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{m.label}</div>
              <div className={`flex items-center gap-1 text-lg font-bold leading-none ${m.trophy ? "text-[var(--sun)]" : ""}`}>
                {m.trophy && <Award size={16} className="shrink-0" />}
                {m.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mídias: carrossel mapa/foto/vídeo (Req 5) */}
      {media.length > 0 ? (
        <MediaCarousel
          media={media}
          fallbackSrc={community1}
          poster={poster}
          onPressMain={post.activityId && onOpenActivity ? () => onOpenActivity(post.activityId!) : undefined}
          mainAriaLabel={t("activity.detailTitle", "Ver atividade")}
        />
      ) : (
        <SafeImage src={post.img} alt="" fallbackSrc={community1} />
      )}

      <div className="p-4">
        {/* Ações (mantidas como hoje) */}
        <div className="flex items-center gap-4 text-foreground">
          <button
            onClick={handleLikeClick}
            className={`flex items-center gap-1.5 text-sm transition-colors ${post.liked ? "text-red-500" : ""}`}
          >
            <span className="relative inline-grid place-items-center">
              <Heart
                size={20}
                fill={post.liked ? "currentColor" : "none"}
                className={burst ? "animate-[ov-heart-pop_0.5s_ease-out]" : ""}
              />
              {/* Partículas do "burst" ao curtir */}
              {burst && (
                <span className="pointer-events-none absolute inset-0">
                  {[0, 60, 120, 180, 240, 300].map((deg) => (
                    <span
                      key={deg}
                      className="absolute left-1/2 top-1/2 h-1 w-1 rounded-full bg-red-500"
                      style={{ animation: `ov-heart-particle 0.6s ease-out forwards`, ["--ov-angle" as string]: `${deg}deg` }}
                    />
                  ))}
                </span>
              )}
            </span>
            <span className="font-medium">{post.likes}</span>
          </button>
          <button onClick={() => onToggleComments(post.id)} className="flex items-center gap-1.5 text-sm">
            <MessageCircle size={20} />
            <span className="font-medium">{post.comments}</span>
          </button>
          <button onClick={() => onShare(post)} className="ml-auto" aria-label={t("common.share")}>
            <Share2 size={20} />
          </button>
        </div>

        {/* Likes com avatares + total (Req 6) */}
        {post.likes > 0 && (
          <div className="mt-3">
            <LikeAvatars avatars={likeAvatars} total={post.likes} />
          </div>
        )}

        {/* Slot de conquista/nível (Req 4). Selo de KOM/troféu de segmento
            (estilo Strava) quando a atividade conquistou top-10 num segmento;
            caso contrário, o selo de "Atividade concluída". */}
        {isActivity && post.segmentTrophy && post.segmentTrophy.bestRank <= 10 ? (
          (() => {
            const tr = post.segmentTrophy!;
            const isKing = tr.bestRank === 1;
            return (
              <Link
                to="/segmento/$segmentId"
                params={{ segmentId: tr.segmentId }}
                className={`mt-3 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs transition-base active:scale-[0.98] ${
                  isKing
                    ? "bg-gradient-to-r from-amber-400/20 to-yellow-500/10 text-amber-600 ring-1 ring-amber-400/40"
                    : "bg-[var(--sun)]/10 text-[var(--sun)]"
                }`}
              >
                {isKing ? <Crown size={16} className="shrink-0" /> : <Medal size={15} className="shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold leading-tight">
                    {isKing
                      ? t("community.segmentKom", { defaultValue: "KOM conquistado!" })
                      : t("community.segmentTrophy", { rank: tr.bestRank, defaultValue: `Top ${tr.bestRank} no segmento` })}
                  </div>
                  {tr.segmentName && (
                    <div className="truncate text-[11px] opacity-80">
                      {tr.segmentName}
                      {tr.avgSpeedKmh > 0 ? ` · ${tr.avgSpeedKmh.toFixed(1)} km/h` : ""}
                      {tr.trophyCount > 1
                        ? ` · ${t("community.segmentMoreTrophies", { count: tr.trophyCount - 1, defaultValue: `+${tr.trophyCount - 1} troféu(s)` })}`
                        : ""}
                    </div>
                  )}
                </div>
                <Trophy size={13} className="shrink-0 opacity-60" />
              </Link>
            );
          })()
        ) : isActivity ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-[var(--sun)]/10 px-3 py-2 text-xs text-[var(--sun)]">
            <Trophy size={14} />
            <span className="font-medium">{t("community.activityCompleted", "Atividade concluída")}</span>
          </div>
        ) : null}

        {/* Categoria (mantida) */}
        <span className="mt-3 inline-block rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-secondary-foreground">
          {t(communityCategoryTranslationKey(post.category))}
        </span>

        {showCommentsButton && (
          <button onClick={() => onToggleComments(post.id)} className="mt-2 block text-xs text-muted-foreground">
            {commentsExpanded
              ? t("community.hideComments")
              : t("community.showComments", { count: post.comments })}
          </button>
        )}
        {commentsExpanded && commentsNode}
      </div>
    </article>
  );
}
