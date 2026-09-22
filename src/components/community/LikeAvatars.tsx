import { resolveAsset } from "@/lib/api";
import type { PostLikeAvatar } from "@/lib/api";
import { formatLikeSummary } from "@/lib/community-card";
import avatarFallback from "@/assets/avatar-rafael.jpg";
import { useTranslation } from "react-i18next";

/**
 * Linha de curtidas estilo Strava: até 3 avatares sobrepostos + total.
 * Não aparece quando não há curtidas (Req 6.3).
 */
export function LikeAvatars({
  avatars,
  total,
}: {
  avatars: PostLikeAvatar[];
  total: number;
}) {
  const { t } = useTranslation();
  if (!total || total <= 0) return null;
  const shown = avatars.slice(0, 3);
  return (
    <div className="flex items-center gap-2">
      {shown.length > 0 && (
        <div className="flex -space-x-2">
          {shown.map((a) => (
            <img
              key={a.userId}
              src={resolveAsset(a.avatarUrl, avatarFallback)}
              alt={a.fullName ?? ""}
              loading="lazy"
              className="h-6 w-6 rounded-full border-2 border-card object-cover"
            />
          ))}
        </div>
      )}
      <span className="text-xs font-medium text-muted-foreground">
        {t("community.gaveKudos", { count: total, value: formatLikeSummary(total) })}
      </span>
    </div>
  );
}
