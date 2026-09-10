import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ShieldAlert, Plus, Trash2, Lightbulb, CheckCircle2, Circle } from "lucide-react";
import { StatusBar } from "@/components/StatusBar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  isCurrentUserAdmin,
  fetchAdminSuggestions,
  createAdminSuggestion,
  setAdminSuggestionDone,
  deleteAdminSuggestion,
} from "@/lib/api";
import i18n from "@/lib/i18n";

export const Route = createFileRoute("/admin/melhorias")({
  component: AdminMelhorias,
  head: () => ({
    meta: [
      { title: "Dicas / Melhorias — OutVitar Admin" },
      { name: "description", content: "Checklist de dicas e melhorias do OutVitar." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/admin/melhorias" }],
  }),
});

// Checklist administrativo de Dicas/Melhorias (tabela admin_suggestions).
// O admin registra uma dica/melhoria (vira um item pendente) e, quando
// estiver feita, marca como pronto. Itens pendentes ficam no topo.
function AdminMelhorias() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  const { data: isAdmin, isLoading: isAdminLoading } = useQuery({
    queryKey: ["is-current-user-admin", user?.id],
    queryFn: isCurrentUserAdmin,
    enabled: !!user,
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin-suggestions"],
    queryFn: fetchAdminSuggestions,
    enabled: !!user && isAdmin === true,
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-suggestions"] });

  const createMutation = useMutation({
    mutationFn: () => createAdminSuggestion({ title, description }),
    onSuccess: () => {
      setTitle("");
      setDescription("");
      invalidate();
      toast.success(t("adminTips.created"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => setAdminSuggestionDone(id, done),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAdminSuggestion(id),
    onSuccess: () => {
      invalidate();
      toast.success(t("adminTips.deleted"));
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setToDelete(null),
  });

  const handleCreate = () => {
    if (!title.trim()) {
      toast.error(t("adminTips.errorTitle"));
      return;
    }
    createMutation.mutate();
  };

  if (authLoading || (!!user && isAdminLoading)) {
    return (
      <div className="pb-12">
        <div className="bg-gradient-forest px-5 pb-4 text-white">
          <StatusBar light />
          <div className="pt-2 text-center text-xs font-medium uppercase tracking-widest text-white/70">
            {t("admin.title", "Administração")}
          </div>
        </div>
        <div className="px-5 mt-4 space-y-2">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (isAdmin !== true) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-muted">
          <ShieldAlert size={24} className="text-muted-foreground" />
        </div>
        <h2 className="mt-4 font-display text-xl font-semibold">{t("adminCompliance.accessDeniedTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("adminCompliance.accessDeniedDescription")}</p>
        <Link to="/" className="mt-6 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground">
          {t("adminCompliance.backToHome")}
        </Link>
      </div>
    );
  }

  const pendingCount = items.filter((i) => !i.done).length;
  const doneCount = items.length - pendingCount;

  return (
    <div className="pb-24">
      <div className="bg-gradient-forest px-5 pb-4 text-white">
        <StatusBar light />
        <div className="flex items-center justify-between pt-2">
          <Link to="/admin" className="grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur-md">
            <ArrowLeft size={16} />
          </Link>
          <span className="text-xs font-medium uppercase tracking-widest text-white/70">
            {t("admin.title", "Administração")}
          </span>
          <span className="w-9" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-semibold">{t("adminTips.title")}</h1>
        <p className="mt-1 text-sm text-white/80">{t("adminTips.subtitle")}</p>
      </div>

      {/* Formulário de nova dica/melhoria */}
      <section className="px-5 mt-4">
        <div className="rounded-2xl bg-card p-4 shadow-card">
          <div className="flex items-center gap-2">
            <Lightbulb size={16} className="text-[var(--sun)]" />
            <h2 className="text-sm font-semibold">{t("adminTips.newTitle")}</h2>
          </div>
          <div className="mt-3 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="tip-title">{t("adminTips.titleLabel")}</Label>
              <Input
                id="tip-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("adminTips.titlePlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tip-desc">{t("adminTips.descriptionLabel")}</Label>
              <Textarea
                id="tip-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder={t("adminTips.descriptionPlaceholder")}
              />
            </div>
            <button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-card active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              <Plus size={16} /> {t("adminTips.add")}
            </button>
          </div>
        </div>
      </section>

      {/* Contadores */}
      {items.length > 0 && (
        <section className="px-5 mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-card p-3 shadow-card text-center">
            <div className="font-display text-2xl font-semibold tabular-nums text-primary">{pendingCount}</div>
            <div className="text-[11px] text-muted-foreground">{t("adminTips.pending")}</div>
          </div>
          <div className="rounded-2xl bg-card p-3 shadow-card text-center">
            <div className="font-display text-2xl font-semibold tabular-nums text-[var(--verified)]">{doneCount}</div>
            <div className="text-[11px] text-muted-foreground">{t("adminTips.done")}</div>
          </div>
        </section>
      )}

      {/* Checklist */}
      <section className="px-5 mt-4 space-y-2">
        {isLoading ? (
          <>
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border py-10 text-center text-xs text-muted-foreground">
            {t("adminTips.empty")}
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={`flex items-start gap-3 rounded-2xl bg-card p-4 shadow-card ${item.done ? "opacity-70" : ""}`}
            >
              <button
                onClick={() => toggleMutation.mutate({ id: item.id, done: !item.done })}
                disabled={toggleMutation.isPending}
                className="mt-0.5 shrink-0"
                aria-label={item.done ? t("adminTips.markPending") : t("adminTips.markDone")}
              >
                {item.done ? (
                  <CheckCircle2 size={22} className="text-[var(--verified)]" />
                ) : (
                  <Circle size={22} className="text-muted-foreground" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <div className={`text-sm font-semibold ${item.done ? "line-through text-muted-foreground" : ""}`}>
                  {item.title}
                </div>
                {item.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                )}
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {item.done && item.done_at
                    ? t("adminTips.doneOn", {
                        date: new Date(item.done_at).toLocaleDateString(i18n.language),
                      })
                    : t("adminTips.createdOn", {
                        date: new Date(item.created_at).toLocaleDateString(i18n.language),
                      })}
                </div>
              </div>
              <button
                onClick={() => setToDelete(item.id)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-destructive"
                aria-label={t("adminTips.delete")}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </section>

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("adminTips.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("adminTips.confirmDeleteDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "Cancelar")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => toDelete && deleteMutation.mutate(toDelete)}>
              {t("adminTips.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
