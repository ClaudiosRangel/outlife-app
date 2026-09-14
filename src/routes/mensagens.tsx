/**
 * Caixa de entrada de mensagens (estilo Instagram Direct): lista as conversas
 * de quem já falou com o usuário, com as não-lidas destacadas (nome em
 * negrito + prévia colorida + ponto verde pulsante), e uma busca de usuários
 * no topo para iniciar uma conversa nova.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Search, PenSquare, MessageCircle } from "lucide-react";
import { StatusBar } from "@/components/StatusBar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { fetchConversations, searchUsers, resolveAsset } from "@/lib/api";
import avatarFallback from "@/assets/avatar-rafael.jpg";

export const Route = createFileRoute("/mensagens")({
  component: MessagesInbox,
  head: () => ({
    meta: [
      { title: "Mensagens — OutVitar" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}sem`;
}

function MessagesInbox() {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    const h = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(h);
  }, [search]);

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: fetchConversations,
    enabled: !!user,
    refetchInterval: 15_000,
  });

  const { data: searchResults = [], isLoading: searching } = useQuery({
    queryKey: ["search-users", debounced],
    queryFn: () => searchUsers(debounced),
    enabled: !!user && debounced.length > 0,
  });

  const totalUnread = useMemo(
    () => conversations.reduce((acc, c) => acc + (c.unread ?? 0), 0),
    [conversations],
  );

  return (
    <div className="pb-16">
      <div className="bg-gradient-forest px-5 pb-4 text-white">
        <StatusBar light />
        <div className="flex items-center justify-between pt-2">
          <Link to="/" className="grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur-md">
            <ArrowLeft size={16} />
          </Link>
          <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-white/70">
            {t("messages.title", "Mensagens")}
            {totalUnread > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {totalUnread > 9 ? "9+" : totalUnread}
              </span>
            )}
          </span>
          <PenSquare size={18} className="opacity-80" />
        </div>
      </div>

      {/* Busca de usuários */}
      <div className="px-5 mt-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("messages.searchPlaceholder", "Buscar usuário para conversar…")}
            className="pl-9"
          />
        </div>
      </div>

      {/* Resultados da busca: iniciar conversa nova */}
      {debounced.length > 0 && (
        <section className="px-5 mt-3">
          <h2 className="text-xs font-semibold text-muted-foreground">
            {t("messages.startNew", "Iniciar conversa")}
          </h2>
          <div className="mt-2 space-y-1">
            {searching ? (
              [0, 1].map((i) => <Skeleton key={i} className="h-14 w-full rounded-2xl" />)
            ) : searchResults.length === 0 ? (
              <div className="rounded-2xl bg-card p-4 text-center text-xs text-muted-foreground shadow-card">
                {t("friends.emptySearch", "Nenhum usuário encontrado.")}
              </div>
            ) : (
              searchResults
                .filter((r) => r.id !== user?.id)
                .map((r) => (
                  <button
                    key={r.id}
                    onClick={() => navigate({ to: "/chat/$userId", params: { userId: r.id } })}
                    className="flex w-full items-center gap-3 rounded-2xl bg-card p-2.5 text-left shadow-card"
                  >
                    <img src={resolveAsset(r.avatar_url, avatarFallback)} alt="" className="h-11 w-11 rounded-full object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{r.full_name || t("friends.placeholderName", "Aventureiro")}</div>
                      {r.username && <div className="truncate text-xs text-muted-foreground">@{r.username}</div>}
                    </div>
                    <MessageCircle size={16} className="text-primary" />
                  </button>
                ))
            )}
          </div>
        </section>
      )}

      {/* Lista de conversas */}
      {debounced.length === 0 && (
        <section className="px-5 mt-4">
          <h2 className="text-xs font-semibold text-muted-foreground">
            {t("messages.conversations", "Conversas")}
          </h2>
          <div className="mt-2 space-y-1">
            {isLoading ? (
              [0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)
            ) : conversations.length === 0 ? (
              <div className="rounded-2xl bg-card p-6 text-center text-xs text-muted-foreground shadow-card">
                {t("messages.empty", "Nenhuma conversa ainda. Busque um usuário acima para começar.")}
              </div>
            ) : (
              conversations.map((c) => {
                const unread = (c.unread ?? 0) > 0;
                return (
                  <Link
                    key={c.other_id}
                    to="/chat/$userId"
                    params={{ userId: c.other_id }}
                    className={`flex items-center gap-3 rounded-2xl p-2.5 shadow-card transition-base active:scale-[0.99] ${
                      unread ? "bg-primary/5 ring-1 ring-primary/20" : "bg-card"
                    }`}
                  >
                    <div className="relative shrink-0">
                      <img src={resolveAsset(c.avatar_url, avatarFallback)} alt="" className="h-12 w-12 rounded-full object-cover" />
                      {unread && (
                        <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 animate-pulse rounded-full border-2 border-background bg-green-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`truncate text-sm ${unread ? "font-bold" : "font-semibold"}`}>
                        {c.full_name || t("friends.placeholderName", "Aventureiro")}
                      </div>
                      <div className={`truncate text-xs ${unread ? "font-medium text-primary" : "text-muted-foreground"}`}>
                        {c.last_text}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-[10px] text-muted-foreground">{timeAgo(c.last_at)}</span>
                      {unread && (
                        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                          {c.unread > 9 ? "9+" : c.unread}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </section>
      )}
    </div>
  );
}
