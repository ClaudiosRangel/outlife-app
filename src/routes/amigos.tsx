import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowLeft, Search, UserCheck, UserMinus, UserPlus } from "lucide-react";
import { StatusBar } from "@/components/StatusBar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import {
  acceptFriendRequest,
  fetchFriends,
  removeFriend,
  resolveAsset,
  searchUsers,
  sendFriendRequest,
  type FriendRow,
  type UserSearchResult,
} from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import avatarFallback from "@/assets/avatar-rafael.jpg";

export const Route = createFileRoute("/amigos")({
  component: FriendsScreen,
  head: () => ({
    meta: [
      { title: "Amigos — Outlife" },
      { name: "description", content: "Busque pessoas, envie e aceite solicitações de amizade." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/amigos" }],
  }),
});

type FriendProfile = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

function otherUserId(row: FriendRow, myId: string): string {
  return row.requester_id === myId ? row.addressee_id : row.requester_id;
}

function FriendsScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  const [searchText, setSearchText] = useState("");
  const [debouncedSearchText, setDebouncedSearchText] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearchText(searchText.trim()), 400);
    return () => clearTimeout(handle);
  }, [searchText]);

  // Requirement 3.1, 3.3, 3.4, 3.5, 3.6 — todo o estado de Friendship
  // (aceitos, pendentes recebidos, e o bloqueio de duplicidade na busca)
  // vem de uma única leitura de `fetchFriends`, filtrada no cliente por
  // status/direção. `status === "following"` (Requirement 7) é ignorado
  // aqui: representa Post_Follow, não Friendship.
  const { data: friendRows = [], isLoading: friendsLoading } = useQuery({
    queryKey: ["friends", user?.id],
    queryFn: fetchFriends,
    enabled: !!user,
  });

  const relevantRows = useMemo(
    () => friendRows.filter((r) => r.status === "accepted" || r.status === "pending"),
    [friendRows],
  );

  const acceptedRows = useMemo(
    () => relevantRows.filter((r) => r.status === "accepted"),
    [relevantRows],
  );
  const pendingReceivedRows = useMemo(
    () => relevantRows.filter((r) => r.status === "pending" && r.addressee_id === user?.id),
    [relevantRows, user?.id],
  );

  const profileIds = useMemo(() => {
    if (!user) return [];
    const ids = relevantRows.map((r) => otherUserId(r, user.id));
    return Array.from(new Set(ids));
  }, [relevantRows, user]);

  const { data: profilesById = {} } = useQuery({
    queryKey: ["friends-profiles", profileIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url")
        .in("id", profileIds);
      if (error) throw error;
      const map: Record<string, FriendProfile> = {};
      for (const p of (data ?? []) as FriendProfile[]) map[p.id] = p;
      return map;
    },
    enabled: !!user && profileIds.length > 0,
  });

  const { data: searchResults = [], isLoading: searchLoading } = useQuery({
    queryKey: ["search-users", debouncedSearchText],
    queryFn: () => searchUsers(debouncedSearchText),
    enabled: !!user && debouncedSearchText.length > 0,
  });

  const sendRequestMutation = useMutation({
    mutationFn: (addresseeId: string) => sendFriendRequest(addresseeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["friends", user?.id] });
      toast.success(t("friends.requestSent"));
    },
    onError: (err: Error) => toast.error(err.message || t("friends.genericError")),
  });

  const acceptMutation = useMutation({
    mutationFn: (id: string) => acceptFriendRequest(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["friends", user?.id] });
      toast.success(t("friends.requestAccepted"));
    },
    onError: (err: Error) => toast.error(err.message || t("friends.genericError")),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeFriend(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["friends", user?.id] });
      toast.success(t("friends.friendRemoved"));
    },
    onError: (err: Error) => toast.error(err.message || t("friends.genericError")),
  });

  // Requirement 3.6 — bloqueia no client o envio para si mesmo ou para
  // usuário com Friendship existente (pending ou accepted), sem nunca
  // chamar `sendFriendRequest` nesses casos.
  const handleSendRequest = (result: UserSearchResult) => {
    if (!user) return;
    if (result.id === user.id) {
      toast.error(t("friends.errorSelf"));
      return;
    }
    const existing = relevantRows.find((r) => otherUserId(r, user.id) === result.id);
    if (existing?.status === "accepted") {
      toast.error(t("friends.errorAlreadyFriends"));
      return;
    }
    if (existing?.status === "pending") {
      toast.error(t("friends.errorAlreadyPending"));
      return;
    }
    sendRequestMutation.mutate(result.id);
  };

  const relationshipFor = (resultId: string): "self" | "accepted" | "pending" | "none" => {
    if (!user) return "none";
    if (resultId === user.id) return "self";
    const existing = relevantRows.find((r) => otherUserId(r, user.id) === resultId);
    if (existing?.status === "accepted") return "accepted";
    if (existing?.status === "pending") return "pending";
    return "none";
  };

  return (
    <div className="pb-12">
      <div className="bg-gradient-forest px-5 pb-4 text-white">
        <StatusBar light />
        <div className="flex items-center justify-between pt-2">
          <Link to="/perfil" className="grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur-md">
            <ArrowLeft size={16} />
          </Link>
          <span className="text-xs font-medium uppercase tracking-widest text-white/70">
            {t("friends.title")}
          </span>
          <span className="w-9" />
        </div>
      </div>

      <section className="px-5 mt-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={t("friends.searchPlaceholder")}
            className="pl-9"
          />
        </div>
      </section>

      {debouncedSearchText.length > 0 && (
        <section className="px-5 mt-4">
          <h2 className="font-display text-sm font-semibold text-muted-foreground">
            {t("friends.searchResults")}
          </h2>
          <div className="mt-2 space-y-2">
            {searchLoading ? (
              [0, 1].map((i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)
            ) : searchResults.length === 0 ? (
              <div className="rounded-2xl bg-card p-5 text-center text-xs text-muted-foreground shadow-card">
                {t("friends.emptySearch")}
              </div>
            ) : (
              searchResults.map((result) => {
                const relationship = relationshipFor(result.id);
                return (
                  <div
                    key={result.id}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-card p-3 shadow-card"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <img
                        src={resolveAsset(result.avatar_url, avatarFallback)}
                        alt={result.full_name || ""}
                        className="h-10 w-10 rounded-full object-cover"
                        width={80}
                        height={80}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">
                          {result.full_name || t("profile.title")}
                        </div>
                        {result.username && (
                          <div className="truncate text-xs text-muted-foreground">@{result.username}</div>
                        )}
                      </div>
                    </div>
                    {relationship === "self" ? (
                      <span className="shrink-0 text-xs text-muted-foreground">{t("friends.thisIsYou")}</span>
                    ) : relationship === "accepted" ? (
                      <span className="shrink-0 text-xs font-medium text-muted-foreground">
                        {t("friends.statusFriends")}
                      </span>
                    ) : relationship === "pending" ? (
                      <span className="shrink-0 text-xs font-medium text-muted-foreground">
                        {t("friends.statusPending")}
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleSendRequest(result)}
                        disabled={sendRequestMutation.isPending}
                        className="shrink-0"
                      >
                        <UserPlus size={14} className="mr-1" /> {t("friends.sendRequest")}
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      <section className="px-5 mt-6">
        <h2 className="font-display text-sm font-semibold text-muted-foreground">
          {t("friends.pendingReceived")}
        </h2>
        <div className="mt-2 space-y-2">
          {friendsLoading ? (
            <Skeleton className="h-16 w-full rounded-2xl" />
          ) : pendingReceivedRows.length === 0 ? (
            <div className="rounded-2xl bg-card p-5 text-center text-xs text-muted-foreground shadow-card">
              {t("friends.emptyPendingReceived")}
            </div>
          ) : (
            pendingReceivedRows.map((row) => {
              const other = profilesById[otherUserId(row, user!.id)];
              return (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-card p-3 shadow-card"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <img
                      src={resolveAsset(other?.avatar_url, avatarFallback)}
                      alt={other?.full_name || ""}
                      className="h-10 w-10 rounded-full object-cover"
                      width={80}
                      height={80}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">
                        {other?.full_name || t("profile.title")}
                      </div>
                      {other?.username && (
                        <div className="truncate text-xs text-muted-foreground">@{other.username}</div>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => acceptMutation.mutate(row.id)}
                    disabled={acceptMutation.isPending}
                    className="shrink-0"
                  >
                    <UserCheck size={14} className="mr-1" /> {t("friends.accept")}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="px-5 mt-6">
        <h2 className="font-display text-sm font-semibold text-muted-foreground">
          {t("friends.accepted")}
        </h2>
        <div className="mt-2 space-y-2">
          {friendsLoading ? (
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)
          ) : acceptedRows.length === 0 ? (
            <div className="rounded-2xl bg-card p-5 text-center text-xs text-muted-foreground shadow-card">
              {t("friends.emptyAccepted")}
            </div>
          ) : (
            acceptedRows.map((row) => {
              const other = profilesById[otherUserId(row, user!.id)];
              return (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-card p-3 shadow-card"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <img
                      src={resolveAsset(other?.avatar_url, avatarFallback)}
                      alt={other?.full_name || ""}
                      className="h-10 w-10 rounded-full object-cover"
                      width={80}
                      height={80}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">
                        {other?.full_name || t("profile.title")}
                      </div>
                      {other?.username && (
                        <div className="truncate text-xs text-muted-foreground">@{other.username}</div>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeMutation.mutate(row.id)}
                    disabled={removeMutation.isPending}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <UserMinus size={14} className="mr-1" /> {t("friends.remove")}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
