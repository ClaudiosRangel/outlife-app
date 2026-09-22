import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Search, Trash2, Megaphone, Ban, ShieldCheck, Loader2, ShieldAlert } from "lucide-react";
import { StatusBar } from "@/components/StatusBar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  isCurrentUserAdmin,
  adminListUsers,
  adminUserPosts,
  adminUserEvents,
  adminDeletePost,
  adminDeleteEvent,
  adminSendWarning,
  adminSetBan,
  resolveAsset,
  type UserSearchResult,
} from "@/lib/api";
import avatarFallback from "@/assets/avatar-rafael.jpg";

export const Route = createFileRoute("/admin/moderacao")({
  component: AdminModeration,
  head: () => ({
    meta: [
      { title: "Moderação — OutVitar Admin" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/admin/moderacao" }],
  }),
});

function AdminModeration() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, loading } = useAuth();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selected, setSelected] = useState<UserSearchResult | null>(null);
  const [warning, setWarning] = useState("");

  // Debounce da busca incremental (300ms) para não consultar a cada tecla.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const { data: isAdmin, isLoading: adminLoading } = useQuery({
    queryKey: ["is-current-user-admin", user?.id],
    queryFn: isCurrentUserAdmin,
    enabled: !!user,
  });

  // Lista/busca de usuários: carrega todos ao entrar e filtra enquanto digita
  // (busca incremental com debounce). Só ativa quando não há usuário selecionado.
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["admin-list-users", debouncedQuery],
    queryFn: () => adminListUsers(debouncedQuery),
    enabled: !!user && isAdmin === true && !selected,
  });

  const { data: posts = [] } = useQuery({
    queryKey: ["admin-user-posts", selected?.id],
    queryFn: () => adminUserPosts(selected!.id),
    enabled: !!selected,
  });
  const { data: events = [] } = useQuery({
    queryKey: ["admin-user-events", selected?.id],
    queryFn: () => adminUserEvents(selected!.id),
    enabled: !!selected,
  });

  const delPost = useMutation({
    mutationFn: (id: string) => adminDeletePost(id),
    onSuccess: () => { toast.success("Publicação excluída."); qc.invalidateQueries({ queryKey: ["admin-user-posts", selected?.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delEvent = useMutation({
    mutationFn: (id: string) => adminDeleteEvent(id),
    onSuccess: () => { toast.success("Evento excluído."); qc.invalidateQueries({ queryKey: ["admin-user-events", selected?.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const sendWarn = useMutation({
    mutationFn: () => adminSendWarning(selected!.id, warning.trim()),
    onSuccess: () => { toast.success("Aviso enviado."); setWarning(""); },
    onError: (e: Error) => toast.error(e.message),
  });
  const setBan = useMutation({
    mutationFn: (banned: boolean) => adminSetBan(selected!.id, banned, banned ? "Violação das diretrizes" : undefined),
    onSuccess: (_d, banned) => toast.success(banned ? "Usuário banido." : "Usuário desbanido."),
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading || (!!user && adminLoading)) {
    return <div className="p-6 text-center text-sm text-muted-foreground">Carregando…</div>;
  }
  if (!user) return null;
  if (isAdmin !== true) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <ShieldAlert size={28} className="mb-3 text-muted-foreground" />
        <h2 className="font-display text-xl font-semibold">Acesso restrito</h2>
        <Link to="/" className="mt-4 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Início</Link>
      </div>
    );
  }

  return (
    <div className="pb-12">
      <div className="bg-gradient-forest px-5 pb-4 text-white">
        <StatusBar light />
        <div className="flex items-center justify-between pt-2">
          <Link to="/admin" className="grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur-md">
            <ArrowLeft size={16} />
          </Link>
          <span className="text-xs font-medium uppercase tracking-widest text-white/70">Moderação</span>
          <span className="w-9" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-semibold">Moderação por usuário</h1>
        <p className="mt-1 text-sm text-white/80">Buscar usuário, moderar publicações/eventos, avisar ou banir.</p>
      </div>

      {/* Busca de usuário — lista já carregada + filtro incremental ao digitar */}
      {!selected && (
        <div className="mx-5 mt-4">
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-3">
            <Search size={18} className="text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome ou @usuário"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {usersLoading && <Loader2 size={16} className="animate-spin text-muted-foreground" />}
          </div>

          <div className="mt-1.5 flex items-center justify-between px-1">
            <span className="text-[11px] text-muted-foreground">
              {debouncedQuery ? `Resultados para "${debouncedQuery}"` : "Todos os usuários"}
            </span>
            <span className="text-[11px] text-muted-foreground">{users.length}</span>
          </div>

          <div className="mt-2 space-y-1.5">
            {!usersLoading && users.length === 0 && (
              <p className="rounded-2xl bg-card p-4 text-center text-xs text-muted-foreground shadow-card">
                Nenhum usuário encontrado.
              </p>
            )}
            {users.map((u) => (
              <button
                key={u.id}
                onClick={() => setSelected(u)}
                className="flex w-full items-center gap-3 rounded-2xl bg-card p-3 text-left shadow-card"
              >
                <img src={resolveAsset(u.avatar_url, avatarFallback)} alt="" className="h-9 w-9 rounded-full object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{u.full_name ?? "Aventureiro"}</div>
                  {u.username && <div className="truncate text-[11px] text-muted-foreground">@{u.username}</div>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <div className="mx-5 mt-4 space-y-4">
          {/* Cabeçalho do usuário selecionado */}
          <div className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card">
            <img src={resolveAsset(selected.avatar_url, avatarFallback)} alt="" className="h-11 w-11 rounded-full object-cover" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{selected.full_name ?? "Aventureiro"}</div>
              {selected.username && <div className="truncate text-[11px] text-muted-foreground">@{selected.username}</div>}
            </div>
            <button onClick={() => setSelected(null)} className="text-xs text-muted-foreground underline">Trocar</button>
          </div>

          {/* Aviso + banir */}
          <div className="rounded-2xl bg-card p-3 shadow-card">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Megaphone size={15} /> Enviar aviso</div>
            <textarea
              value={warning}
              onChange={(e) => setWarning(e.target.value)}
              rows={2}
              placeholder="Mensagem de aviso ao usuário…"
              className="w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:ring-1 ring-ring resize-none"
            />
            <div className="mt-2 flex gap-2">
              <Button className="flex-1 h-10 rounded-xl" disabled={!warning.trim() || sendWarn.isPending} onClick={() => sendWarn.mutate()}>
                {sendWarn.isPending ? <Loader2 size={15} className="animate-spin" /> : <Megaphone size={15} className="mr-1" />} Enviar aviso
              </Button>
            </div>
            <div className="mt-2 flex gap-2">
              <Button variant="outline" className="flex-1 h-10 rounded-xl border-destructive/40 text-destructive" disabled={setBan.isPending} onClick={() => setBan.mutate(true)}>
                <Ban size={15} className="mr-1" /> Banir
              </Button>
              <Button variant="outline" className="flex-1 h-10 rounded-xl" disabled={setBan.isPending} onClick={() => setBan.mutate(false)}>
                <ShieldCheck size={15} className="mr-1" /> Desbanir
              </Button>
            </div>
          </div>

          {/* Publicações do usuário */}
          <div>
            <h2 className="mb-2 text-sm font-semibold">Publicações ({posts.length})</h2>
            <div className="space-y-1.5">
              {posts.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma publicação.</p>}
              {posts.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card">
                  {p.imageUrl && <img src={resolveAsset(p.imageUrl)} alt="" className="h-10 w-10 rounded-lg object-cover" />}
                  <span className="min-w-0 flex-1 truncate text-sm">{p.text || "(sem texto)"}</span>
                  <button onClick={() => delPost.mutate(p.id)} className="text-destructive" aria-label="Excluir publicação">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Eventos do usuário */}
          <div>
            <h2 className="mb-2 text-sm font-semibold">Eventos ({events.length})</h2>
            <div className="space-y-1.5">
              {events.length === 0 && <p className="text-xs text-muted-foreground">Nenhum evento.</p>}
              {events.map((e) => (
                <div key={e.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card">
                  <span className="min-w-0 flex-1 truncate text-sm">{e.title}</span>
                  <span className="text-[10px] text-muted-foreground">{new Date(e.eventDate).toLocaleDateString("pt-BR")}</span>
                  <button onClick={() => delEvent.mutate(e.id)} className="text-destructive" aria-label="Excluir evento">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
