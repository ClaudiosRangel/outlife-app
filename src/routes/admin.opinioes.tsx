import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ShieldAlert, Star, MessageSquare } from "lucide-react";
import { StatusBar } from "@/components/StatusBar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { isCurrentUserAdmin, fetchAdminFeedback, resolveAsset } from "@/lib/api";
import avatarFallback from "@/assets/avatar-rafael.jpg";
import i18n from "@/lib/i18n";

export const Route = createFileRoute("/admin/opinioes")({
  component: AdminFeedback,
  head: () => ({
    meta: [
      { title: "Opiniões — OutVitar Admin" },
      { name: "description", content: "Opiniões e sugestões dos usuários." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/admin/opinioes" }],
  }),
});

function AdminFeedback() {
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

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin-feedback"],
    queryFn: () => fetchAdminFeedback(200),
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
        <h1 className="mt-4 font-display text-2xl font-semibold">{t("adminFeedback.title")}</h1>
        <p className="mt-1 text-sm text-white/80">{t("adminFeedback.subtitle")}</p>
      </div>

      <section className="px-5 mt-4 space-y-2">
        {isLoading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)
        ) : items.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border py-10 text-center text-xs text-muted-foreground">
            {t("adminFeedback.empty")}
          </div>
        ) : (
          items.map((f) => (
            <div key={f.id} className="rounded-2xl bg-card p-4 shadow-card">
              <div className="flex items-center gap-3">
                <img
                  src={resolveAsset(f.avatar_url, avatarFallback)}
                  alt=""
                  className="h-9 w-9 rounded-full object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{f.full_name ?? "Usuário"}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(f.created_at).toLocaleDateString(i18n.language)}{" "}
                    {new Date(f.created_at).toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                {f.rating != null && (
                  <div className="flex items-center gap-1 rounded-full bg-[var(--sun)]/10 px-2 py-0.5">
                    <Star size={10} className="fill-[var(--sun)] text-[var(--sun)]" />
                    <span className="text-[11px] font-medium">{f.rating}</span>
                  </div>
                )}
              </div>
              <div className="mt-2 flex items-start gap-2">
                <MessageSquare size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
                <p className="text-sm leading-relaxed text-foreground/90">{f.message}</p>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
