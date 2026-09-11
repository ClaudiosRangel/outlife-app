import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ShieldAlert, Users, UserCheck, FileText, Heart, Star, Activity, MapPin, Calendar, Sparkles } from "lucide-react";
import { StatusBar } from "@/components/StatusBar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { isCurrentUserAdmin, fetchAdminDashboardStats } from "@/lib/api";

export const Route = createFileRoute("/admin/dashboard")({
  component: AdminDashboard,
  head: () => ({
    meta: [
      { title: "Dashboard — OutVitar Admin" },
      { name: "description", content: "Métricas gerais do OutVitar." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/admin/dashboard" }],
  }),
});

function AdminDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  const { data: isAdmin, isLoading: isAdminLoading } = useQuery({
    queryKey: ["is-current-user-admin", user?.id],
    queryFn: isCurrentUserAdmin,
    enabled: !!user,
  });

  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-dashboard-stats"],
    queryFn: fetchAdminDashboardStats,
    enabled: !!user && isAdmin === true,
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
        <div className="px-5 mt-4 grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
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

  const cards = stats
    ? [
        { icon: Users, label: t("adminDash.usersTotal"), value: stats.usuarios_total, sub: t("adminDash.newIn7d", { n: stats.novos_7d }) },
        { icon: UserCheck, label: t("adminDash.active7d"), value: stats.ativos_7d, sub: t("adminDash.active30d", { n: stats.ativos_30d }) },
        { icon: FileText, label: t("adminDash.posts"), value: stats.publicacoes_total, sub: t("adminDash.newIn7d", { n: stats.publicacoes_7d }) },
        { icon: Sparkles, label: t("adminDash.interactions"), value: stats.interacoes_total, sub: `${stats.curtidas_total}❤ ${stats.comentarios_total}💬 ${stats.avaliacoes_total}★` },
        { icon: Heart, label: t("adminDash.likes"), value: stats.curtidas_total, sub: "" },
        { icon: Star, label: t("adminDash.reviews"), value: stats.avaliacoes_total, sub: "" },
        { icon: Activity, label: t("adminDash.activities"), value: stats.atividades_total, sub: t("adminDash.newIn7d", { n: stats.atividades_7d }) },
        { icon: Calendar, label: t("adminDash.events"), value: stats.eventos_total, sub: "" },
        { icon: MapPin, label: t("adminDash.destinations"), value: stats.destinos_total, sub: "" },
        { icon: UserCheck, label: t("adminDash.verified"), value: stats.usuarios_verificados, sub: "" },
      ]
    : [];

  return (
    <div className="pb-12">
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
        <h1 className="mt-4 font-display text-2xl font-semibold">{t("adminDash.title")}</h1>
        <p className="mt-1 text-sm text-white/80">{t("adminDash.subtitle")}</p>
      </div>

      <section className="px-5 mt-4 grid grid-cols-2 gap-3">
        {isLoading ? (
          [0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
        ) : (
          cards.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.label} className="rounded-2xl bg-card p-4 shadow-card">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{c.label}</span>
                  <Icon size={16} className="text-primary" />
                </div>
                <div className="mt-2 font-display text-3xl font-semibold tabular-nums">{c.value}</div>
                {c.sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{c.sub}</div>}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
