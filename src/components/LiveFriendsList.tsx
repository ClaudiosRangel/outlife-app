// LiveFriendsList — relação de amigos em atividade ao vivo exibida abaixo do
// MapView na tela Explorar (Requirements 3.2, 3.3, 3.4, 1.3).
//
// Este componente é puramente de apresentação: recebe `friends` já filtrados
// por is_live/visibilidade pelo pai (tarefa 10.1) e NÃO faz fetch aqui. Ao
// tocar num amigo, dispara `onSelectFriend(friendId)` para que a Explore_Screen
// centralize o MapView na posição ao vivo dele (Req 4.1).
import { useTranslation } from "react-i18next";
import { Navigation } from "lucide-react";

import { resolveAsset } from "@/lib/api";
import type { ActivityType, LiveActivityFriend } from "@/lib/api";
import { formatLiveRecency } from "@/lib/live-activity";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export interface LiveFriendsListProps {
  friends: LiveActivityFriend[];
  onSelectFriend: (friendId: string) => void;
}

/** Nome legível do amigo: full_name quando presente, senão username (Req 3.2). */
function resolveName(friend: LiveActivityFriend): string {
  return friend.full_name ?? friend.username ?? "Aventureiro";
}

/** Inicial para o fallback do avatar quando não há imagem. */
function initialOf(friend: LiveActivityFriend): string {
  return resolveName(friend).charAt(0).toUpperCase();
}

export function LiveFriendsList({ friends, onSelectFriend }: LiveFriendsListProps) {
  const { t } = useTranslation();
  const nowMs = Date.now();

  // Rótulo traduzido do activity_type (Req 1.3). Sem utilitário compartilhado no
  // projeto, usamos as chaves i18n liveFriends.activityType.* com fallback para
  // o próprio valor capitalizado caso o tipo seja desconhecido/nulo.
  const activityLabel = (type: ActivityType | null): string | null => {
    if (!type) return null;
    return t(`liveFriends.activityType.${type}`, {
      defaultValue: type.charAt(0).toUpperCase() + type.slice(1),
    });
  };

  return (
    <section className="px-5">
      <h2 className="font-display text-lg font-semibold flex items-center gap-2">
        <Navigation size={16} className="text-green-500" />
        {t("search.activeNow")}
      </h2>

      {friends.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t("liveFriends.empty")}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {friends.map((friend) => {
            const name = resolveName(friend);
            const label = activityLabel(friend.activity_type);
            const recency = formatLiveRecency({
              locationUpdatedAtMs: Date.parse(friend.location_updated_at),
              nowMs,
            });

            return (
              <button
                key={friend.id}
                type="button"
                onClick={() => onSelectFriend(friend.id)}
                className="flex w-full items-center gap-3 rounded-2xl bg-card p-3 text-left shadow-card transition-colors hover:bg-accent"
              >
                <Avatar className="h-12 w-12">
                  <AvatarImage src={resolveAsset(friend.avatar_url)} alt={name} />
                  <AvatarFallback>{initialOf(friend)}</AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{name}</div>
                  {label && <div className="text-sm text-muted-foreground">{label}</div>}
                </div>

                <span
                  className={
                    recency.live
                      ? "flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-green-500"
                      : "whitespace-nowrap text-xs text-muted-foreground"
                  }
                >
                  {recency.live && (
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-500" />
                  )}
                  {recency.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default LiveFriendsList;
