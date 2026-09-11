import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ShieldAlert, ShieldCheck, MapPin, ChevronRight, Lightbulb, LayoutDashboard, Type, Megaphone } from "lucide-react";
import { StatusBar } from "@/components/StatusBar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { isCurrentUserAdmin, fetchPendingCadasturRequests } from "@/lib/api";

export const Route = createFileRoute("/admin/")({
  component: AdminHub,
  head: () => ({
    meta: [
      { title: "Administração — OutVitar Admin" },
      { name: "description", content: "Área administrativa do OutVitar." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/admin" }],
  }),
});

// Hub administrativo — exclusivo para os responsáveis (Admin_Role via
// is_admin/user_roles). Reúne as ferramentas de moderação já existentes
// (aprovar cadastros Cadastur, aprovar destinos) e é o ponto de crescimento
// para novas funcionalidades administrativas.
function AdminHub() {
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

  // Contador de cadastros pendentes (badge no card de Cadastur).
  const { data: pending = [] } = useQuery({
    queryKey: ["pending-cadastur-requests"],
    queryFn: fetchPendingCadasturRequests,
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
        <h2 className="mt-4 font-display text-xl font-semibold">{t("adminCompliance.accessDeniedTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("adminCompliance.accessDeniedDescription")}</p>
        <Link to="/" className="mt-6 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground">
          {t("adminCompliance.backToHome")}
        </Link>
      </div>
    );
  }

  const cards = [
    {
      to: "/admin/compliance" as const,
      icon: ShieldCheck,
      title: t("admin.cadasturTitle", "Aprovar cadastros (Cadastur)"),
      desc: t("admin.cadasturDesc", "Verificar e aprovar parceiros."),
      badge: pending.length,
    },
    {
      to: "/admin/destinos" as const,
      icon: MapPin,
      title: t("admin.destinationsTitle", "Aprovar destinos"),
      desc: t("admin.destinationsDesc", "Revisar destinos sugeridos."),
      badge: 0,
    },
    {
      to: "/admin/dashboard" as const,
      icon: LayoutDashboard,
      title: t("admin.dashboardTitle", "Dashboard"),
      desc: t("admin.dashboardDesc", "Totais de usuários, publicações e interações."),
      badge: 0,
    },
    {
      to: "/admin/conteudo" as const,
      icon: Type,
      title: t("admin.contentTitle", "Textos da Home"),
      desc: t("admin.contentDesc", "Editar o slogan e a chamada da tela inicial."),
      badge: 0,
    },
    {
      to: "/admin/publicar" as const,
      icon: Megaphone,
      title: t("admin.publishTitle", "Publicar interação"),
      desc: t("admin.publishDesc", "Criar post com imagem ou vídeo em qualquer categoria."),
      badge: 0,
    },
    {
      to: "/admin/melhorias" as const,
      icon: Lightbulb,
      title: t("admin.tipsTitle", "Dicas / Melhorias"),
      desc: t("admin.tipsDesc", "Checklist de dicas e melhorias do app."),
      badge: 0,
    },
  ];

  return (
    <div className="pb-12">
      <div className="bg-gradient-forest px-5 pb-4 text-white">
        <StatusBar light />
        <div className="flex items-center justify-between pt-2">
          <Link to="/perfil" className="grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur-md">
            <ArrowLeft size={16} />
          </Link>
          <span className="text-xs font-medium uppercase tracking-widest text-white/70">
            {t("admin.title", "Administração")}
          </span>
          <span className="w-9" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-semibold">{t("admin.hubTitle", "Área administrativa")}</h1>
        <p className="mt-1 text-sm text-white/80">{t("admin.hubSubtitle", "Ferramentas de moderação e gestão.")}</p>
      </div>

      <section className="px-5 mt-4 space-y-2">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.to}
              to={c.to}
              className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-card transition-base active:scale-[0.99]"
            >
              <span className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary">
                <Icon size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{c.title}</div>
                <div className="text-[11px] text-muted-foreground">{c.desc}</div>
              </div>
              {c.badge > 0 && (
                <span className="grid h-6 min-w-6 place-items-center rounded-full bg-red-500 px-1.5 text-[11px] font-semibold text-white">
                  {c.badge > 9 ? "9+" : c.badge}
                </span>
              )}
              <ChevronRight size={16} className="text-muted-foreground" />
            </Link>
          );
        })}
      </section>
    </div>
  );
}
