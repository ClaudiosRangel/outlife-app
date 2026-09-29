// Admin — Códigos de convite (PRÉVIA para a beta). Na beta NÃO há gate/paywall:
// esta tela existe só para o admin gerar/listar códigos, preparando a
// monetização do lançamento. Visível apenas para administradores.

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Ticket, Plus, Copy, Trash2, Loader2, ShieldAlert, Check } from "lucide-react";
import { toast } from "sonner";
import { StatusBar } from "@/components/StatusBar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import {
  isCurrentUserAdmin,
  adminListInviteCodes,
  adminGenerateInviteCode,
  adminDeleteInviteCode,
} from "@/lib/api";

export const Route = createFileRoute("/admin/convites")({
  component: AdminConvites,
  head: () => ({
    meta: [
      { title: "Códigos de convite — OutVitar Admin" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/admin/convites" }],
  }),
});

function AdminConvites() {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: isAdmin, isLoading: isAdminLoading } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: isCurrentUserAdmin,
    enabled: !!user,
  });

  const { data: codes = [], isLoading } = useQuery({
    queryKey: ["admin-invite-codes"],
    queryFn: () => adminListInviteCodes(200),
    enabled: !!user && isAdmin === true,
  });

  const [grantType, setGrantType] = useState<"year" | "lifetime">("year");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const genMut = useMutation({
    mutationFn: () => adminGenerateInviteCode(grantType, note.trim() || null),
    onSuccess: (c) => {
      setNote("");
      qc.invalidateQueries({ queryKey: ["admin-invite-codes"] });
      toast.success(t("adminInvites.generated", { defaultValue: "Código gerado: {{code}}", code: c.code }));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => adminDeleteInviteCode(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-invite-codes"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 1500);
    } catch {
      toast.error(t("common.shareError", { defaultValue: "Não foi possível copiar." }));
    }
  };

  if (authLoading || (!!user && isAdminLoading)) {
    return (
      <div className="pb-12">
        <div className="bg-gradient-forest px-5 pb-4 text-white"><StatusBar light /></div>
        <div className="px-5 mt-4 space-y-2">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
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
        <h2 className="mt-4 font-display text-xl font-semibold">{t("adminCompliance.accessDeniedTitle", "Acesso restrito")}</h2>
        <Link to="/" className="mt-6 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground">
          {t("adminCompliance.backToHome", "Voltar ao início")}
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-12">
      <div className="bg-gradient-forest px-5 pb-4 text-white">
        <StatusBar light />
        <div className="flex items-center justify-between pt-2">
          <button onClick={() => navigate({ to: "/admin" })} className="grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur-md">
            <ArrowLeft size={16} />
          </button>
          <span className="text-xs font-medium uppercase tracking-widest text-white/70">
            {t("adminInvites.title", { defaultValue: "Códigos de convite" })}
          </span>
          <span className="w-9" />
        </div>
        <h1 className="mt-3 font-display text-2xl font-semibold">{t("adminInvites.title", { defaultValue: "Códigos de convite" })}</h1>
        <p className="mt-1 text-sm text-white/80">
          {t("adminInvites.subtitle", { defaultValue: "Prévia da monetização. Na beta os códigos ainda não liberam acesso — o app é liberado pelo cadastro." })}
        </p>
      </div>

      {/* Gerar novo código */}
      <div className="mx-5 mt-4 rounded-2xl bg-card p-4 shadow-card">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Plus size={15} className="text-primary" /> {t("adminInvites.newTitle", { defaultValue: "Gerar novo código" })}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setGrantType("year")}
            className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-base ${grantType === "year" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
          >
            {t("adminInvites.year", { defaultValue: "1 ano" })}
          </button>
          <button
            onClick={() => setGrantType("lifetime")}
            className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-base ${grantType === "lifetime" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
          >
            {t("adminInvites.lifetime", { defaultValue: "Vitalício" })}
          </button>
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("adminInvites.notePlaceholder", { defaultValue: "Observação (opcional): para quem é este código" })}
          className="mt-2 w-full rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          onClick={() => genMut.mutate()}
          disabled={genMut.isPending}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#f97316] py-3 text-sm font-bold text-white active:scale-[0.98] disabled:opacity-60"
        >
          {genMut.isPending ? <Loader2 size={16} className="animate-spin" /> : <Ticket size={16} />}
          {t("adminInvites.generate", { defaultValue: "Gerar código" })}
        </button>
      </div>

      {/* Lista de códigos */}
      <div className="mx-5 mt-4 space-y-2">
        {isLoading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)
        ) : codes.length === 0 ? (
          <div className="rounded-2xl bg-card p-6 text-center text-xs text-muted-foreground shadow-card">
            {t("adminInvites.empty", { defaultValue: "Nenhum código gerado ainda." })}
          </div>
        ) : (
          codes.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Ticket size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-display text-base font-bold tracking-wide">{c.code}</span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-secondary-foreground">
                    {c.grantType === "lifetime" ? t("adminInvites.lifetime", { defaultValue: "Vitalício" }) : t("adminInvites.year", { defaultValue: "1 ano" })}
                  </span>
                  {c.usedAt && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {t("adminInvites.used", { defaultValue: "Usado" })}
                    </span>
                  )}
                </div>
                {c.note && <div className="truncate text-[11px] text-muted-foreground">{c.note}</div>}
              </div>
              <button
                onClick={() => copyCode(c.code)}
                aria-label={t("adminInvites.copy", { defaultValue: "Copiar" })}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary text-foreground active:scale-95"
              >
                {copied === c.code ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
              </button>
              {!c.usedAt && (
                <button
                  onClick={() => delMut.mutate(c.id)}
                  aria-label={t("common.delete", { defaultValue: "Excluir" })}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary text-muted-foreground transition-base hover:text-destructive active:scale-95"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
