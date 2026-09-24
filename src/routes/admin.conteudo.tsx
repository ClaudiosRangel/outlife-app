import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ShieldAlert, Save, RotateCcw } from "lucide-react";
import { StatusBar } from "@/components/StatusBar";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { isCurrentUserAdmin, fetchAppContent, upsertAppContent } from "@/lib/api";

export const Route = createFileRoute("/admin/conteudo")({
  component: AdminContent,
  head: () => ({
    meta: [
      { title: "Textos da Home — OutVitar Admin" },
      { name: "description", content: "Edite os textos exibidos na tela inicial." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/admin/conteudo" }],
  }),
});

// Default de fábrica (mostrado como referência e usado no botão "Restaurar").
const DEFAULT_SLOGAN = "“A vida não é só trilhar.\nViver é diferente\nde estar vivo.”";
const DEFAULT_ECOSYSTEM = "OutVitar · ecossistema";

function AdminContent() {
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

  const { data: content, isLoading } = useQuery({
    queryKey: ["app-content"],
    queryFn: fetchAppContent,
    enabled: !!user && isAdmin === true,
  });

  const [slogan, setSlogan] = useState("");
  const [ecosystem, setEcosystem] = useState("");
  // Config do programa de indicação (mesmas chaves referral.* em app_content).
  const [refEnabled, setRefEnabled] = useState(true);
  const [refPercent, setRefPercent] = useState("15");
  const [refDays, setRefDays] = useState("60");

  useEffect(() => {
    if (content) {
      setSlogan(content["home.slogan"] ?? DEFAULT_SLOGAN);
      setEcosystem(content["home.ecosystem"] ?? DEFAULT_ECOSYSTEM);
      setRefEnabled((content["referral.enabled"] ?? "true") === "true");
      setRefPercent(content["referral.discount_percent"] ?? "15");
      setRefDays(content["referral.coupon_days"] ?? "60");
    }
  }, [content]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await upsertAppContent("home.slogan", slogan);
      await upsertAppContent("home.ecosystem", ecosystem);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-content"] });
      toast.success(t("adminContent.saved"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveReferralMutation = useMutation({
    mutationFn: async () => {
      const pct = Math.max(0, Math.min(100, Number(refPercent) || 0));
      const days = Math.max(1, Math.min(3650, Number(refDays) || 60));
      await upsertAppContent("referral.enabled", refEnabled ? "true" : "false");
      await upsertAppContent("referral.discount_percent", String(pct));
      await upsertAppContent("referral.coupon_days", String(days));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-content"] });
      toast.success(t("adminReferral.saved", { defaultValue: "Programa de indicação salvo." }));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (authLoading || (!!user && isAdminLoading)) {
    return (
      <div className="pb-12">
        <div className="bg-gradient-forest px-5 pb-4 text-white">
          <StatusBar light />
          <div className="pt-2 text-center text-xs font-medium uppercase tracking-widest text-white/70">
            {t("admin.title", "Administração")}
          </div>
        </div>
        <div className="px-5 mt-4 space-y-3">
          <Skeleton className="h-28 w-full rounded-2xl" />
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
        <h1 className="mt-4 font-display text-2xl font-semibold">{t("adminContent.title")}</h1>
        <p className="mt-1 text-sm text-white/80">{t("adminContent.subtitle")}</p>
      </div>

      {/* Preview de como fica na Home */}
      <section className="px-5 mt-4">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">{t("adminContent.preview")}</div>
        <div className="rounded-3xl bg-gradient-forest p-6 text-white shadow-float">
          <p className="font-display text-2xl leading-tight uppercase tracking-wide whitespace-pre-line">
            {slogan || DEFAULT_SLOGAN}
          </p>
          <p className="mt-3 text-xs uppercase tracking-widest text-white/70">{ecosystem || DEFAULT_ECOSYSTEM}</p>
        </div>
      </section>

      <section className="px-5 mt-5 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="slogan">{t("adminContent.sloganLabel")}</Label>
          <Textarea id="slogan" value={slogan} onChange={(e) => setSlogan(e.target.value)} rows={3} />
          <p className="text-[11px] text-muted-foreground">{t("adminContent.sloganHint")}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ecosystem">{t("adminContent.ecosystemLabel")}</Label>
          <Input id="ecosystem" value={ecosystem} onChange={(e) => setEcosystem(e.target.value)} />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-card active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            <Save size={16} /> {saveMutation.isPending ? t("common.loading") : t("common.save")}
          </button>
          <button
            onClick={() => { setSlogan(DEFAULT_SLOGAN); setEcosystem(DEFAULT_ECOSYSTEM); }}
            className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3.5 text-sm font-medium"
          >
            <RotateCcw size={16} /> {t("adminContent.restore")}
          </button>
        </div>
      </section>

      {/* Programa de indicação (WhatsApp PRO): % de desconto do cupom que o
          indicador ganha por convite aceito e validade do cupom. */}
      <section className="px-5 mt-8 space-y-4">
        <div className="border-t border-border pt-6">
          <h2 className="font-display text-lg font-semibold">
            {t("adminReferral.title", { defaultValue: "Programa de indicação" })}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("adminReferral.subtitle", {
              defaultValue:
                "Quem convida um amigo que se cadastra ganha um cupom de desconto para usar nas lojas dos parceiros.",
            })}
          </p>
        </div>

        <label className="flex items-center justify-between rounded-2xl bg-card p-3 shadow-card">
          <span className="text-sm font-medium">
            {t("adminReferral.enabled", { defaultValue: "Programa ativo" })}
          </span>
          <input
            type="checkbox"
            checked={refEnabled}
            onChange={(e) => setRefEnabled(e.target.checked)}
            className="h-5 w-5 accent-[var(--forest,#166534)]"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ref-percent">
              {t("adminReferral.percent", { defaultValue: "Desconto (%)" })}
            </Label>
            <Input
              id="ref-percent"
              type="number"
              min={0}
              max={100}
              value={refPercent}
              onChange={(e) => setRefPercent(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ref-days">
              {t("adminReferral.days", { defaultValue: "Validade (dias)" })}
            </Label>
            <Input
              id="ref-days"
              type="number"
              min={1}
              value={refDays}
              onChange={(e) => setRefDays(e.target.value)}
            />
          </div>
        </div>

        <button
          onClick={() => saveReferralMutation.mutate()}
          disabled={saveReferralMutation.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-card active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          <Save size={16} /> {saveReferralMutation.isPending ? t("common.loading") : t("common.save")}
        </button>
      </section>
    </div>
  );
}
