import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Bell } from "lucide-react";
import { StatusBar } from "@/components/StatusBar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchNotifications,
  markNotificationsAsRead,
  resolveAsset,
  type Notification,
} from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import avatarFallback from "@/assets/avatar-rafael.jpg";

export const Route = createFileRoute("/notificacoes")({
  component: NotificationsScreen,
  head: () => ({
    meta: [
      { title: "Notificações — Outlife" },
      { name: "description", content: "Acompanhe solicitações de amizade e outros eventos importantes." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/notificacoes" }],
  }),
});

// NOTA (Requirement 9.8 / task 18.2): a queryKey ["notifications", "unread-count"]
// é o nome combinado para a query de `fetchUnreadNotificationCount` usada pelo
// indicador do sino em `/`. Esta tela invalida essa mesma queryKey ao marcar
// notificações como lidas, para que o indicador desapareça imediatamente sem
// esperar um novo carregamento da página inicial.

type NotifierProfile = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

function NotificationsScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  // Requirement 9.3 — `fetchNotifications` já retorna em ordem cronológica
  // decrescente (ORDER BY created_at DESC no Production_Supabase_Project),
  // então a lista é exibida na ordem recebida, sem reordenação no client.
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: fetchNotifications,
    enabled: !!user,
  });

  // Ids de outros perfis referenciados no payload das notificações, para
  // exibir nome/avatar: `requesterId` (friend_request) e `likerId` (post_like).
  const relatedProfileIds = useMemo(() => {
    const ids = notifications
      .map((n) => {
        if (n.type === "friend_request") return (n.payload as { requesterId?: string }).requesterId;
        if (n.type === "post_like") return (n.payload as { likerId?: string }).likerId;
        return undefined;
      })
      .filter((id): id is string => !!id);
    return Array.from(new Set(ids));
  }, [notifications]);

  const { data: profilesById = {} } = useQuery({
    queryKey: ["notifications-profiles", relatedProfileIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url")
        .in("id", relatedProfileIds);
      if (error) throw error;
      const map: Record<string, NotifierProfile> = {};
      for (const p of (data ?? []) as NotifierProfile[]) map[p.id] = p;
      return map;
    },
    enabled: relatedProfileIds.length > 0,
  });

  // Requirement 9.7 — marca como lidas exatamente as notificações não lidas
  // exibidas nesta sessão de visualização, uma única vez por montagem da
  // tela (o `markedRef` evita repetir a chamada quando o refetch disparado
  // pela própria marcação atualiza a lista).
  const markedRef = useRef(false);
  useEffect(() => {
    if (markedRef.current || notifications.length === 0) return;
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    markedRef.current = true;
    if (unreadIds.length === 0) return;
    markNotificationsAsRead(unreadIds)
      .then(() => {
        qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
        // Requirement 9.8 — indicador do sino em `/` (task 18.2) reaproveita esta queryKey.
        qc.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
      })
      .catch(() => {
        // Falha silenciosa: não impede a visualização das notificações já carregadas.
      });
  }, [notifications, qc, user?.id]);

  function renderNotification(n: Notification) {
    if (n.type === "friend_request") {
      const requesterId = (n.payload as { requesterId?: string }).requesterId;
      const requester = requesterId ? profilesById[requesterId] : undefined;
      return (
        <div key={n.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card">
          <img
            src={resolveAsset(requester?.avatar_url, avatarFallback)}
            alt={requester?.full_name || ""}
            className="h-10 w-10 rounded-full object-cover"
            width={80}
            height={80}
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm">
              <span className="font-semibold">{requester?.full_name || t("profile.title")}</span>{" "}
              {t("notifications.friendRequestText")}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {new Date(n.created_at).toLocaleString("pt-BR")}
            </div>
          </div>
          {!n.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
        </div>
      );
    }

    if (n.type === "post_like") {
      const likerId = (n.payload as { likerId?: string }).likerId;
      const liker = likerId ? profilesById[likerId] : undefined;
      return (
        <div key={n.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card">
          <img
            src={resolveAsset(liker?.avatar_url, avatarFallback)}
            alt={liker?.full_name || ""}
            className="h-10 w-10 rounded-full object-cover"
            width={80}
            height={80}
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm">
              <span className="font-semibold">{liker?.full_name || t("profile.title")}</span>{" "}
              {t("notifications.postLikeText")}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {new Date(n.created_at).toLocaleString("pt-BR")}
            </div>
          </div>
          {!n.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
        </div>
      );
    }

    // Fallback genérico para tipos de notificação futuros/desconhecidos.
    return (
      <div key={n.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
          <Bell size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm">{t("notifications.genericText")}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {new Date(n.created_at).toLocaleString("pt-BR")}
          </div>
        </div>
        {!n.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
      </div>
    );
  }

  return (
    <div className="pb-12">
      <div className="bg-gradient-forest px-5 pb-4 text-white">
        <StatusBar light />
        <div className="flex items-center justify-between pt-2">
          <Link to="/" className="grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur-md">
            <ArrowLeft size={16} />
          </Link>
          <span className="text-xs font-medium uppercase tracking-widest text-white/70">
            {t("notifications.title")}
          </span>
          <span className="w-9" />
        </div>
      </div>

      <section className="px-5 mt-4 space-y-2">
        {isLoading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)
        ) : notifications.length === 0 ? (
          <div className="rounded-2xl bg-card p-5 text-center text-xs text-muted-foreground shadow-card">
            {t("notifications.empty")}
          </div>
        ) : (
          notifications.map(renderNotification)
        )}
      </section>
    </div>
  );
}
