import { Link, useLocation } from "@tanstack/react-router";
import { Home, Search, Compass, Store, Users, User } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "react-i18next";

export function BottomNav() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { t } = useTranslation();

  const tabs = [
    { to: "/", label: t("nav.home"), icon: Home },
    { to: "/busca", label: t("nav.search"), icon: Search },
    { to: "/explorar", label: t("nav.explore"), icon: Compass },
    { to: "/marketplace", label: t("nav.market"), icon: Store },
    { to: "/comunidade", label: t("nav.community"), icon: Users },
    { to: user ? "/perfil" : "/login", label: t("nav.profile"), icon: User },
  ] as const;

  return (
    <nav className="sticky bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-6 px-2 pt-2 pb-2">
        {tabs.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          return (
            <li key={to}>
              <Link to={to} className="flex flex-col items-center gap-1 py-1.5 transition-base">
                <span
                  className={`flex h-9 w-12 items-center justify-center rounded-full transition-base ${
                    active ? "bg-primary/10 text-primary" : "text-muted-foreground"
                  }`}
                >
                  <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
                </span>
                <span className={`text-[10px] font-medium ${active ? "text-primary" : "text-muted-foreground"}`}>
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
