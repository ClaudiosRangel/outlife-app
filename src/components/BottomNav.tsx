import { Link, useLocation } from "@tanstack/react-router";
import { Home, Search, Compass, CalendarDays, Users, User } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { loadActive } from "@/lib/activity-storage";

type NavKey = "home" | "search" | "explore" | "market" | "community" | "profile";

// Comportamento pedido pelo usuário ("como do Instagram"): a aba
// permanece ativa em qualquer sub-rota que pertença a ela (ex.: abrir um
// destino a partir de "/explorar" mantém "Explorar" em destaque, abrir o
// perfil de um parceiro mantém "Mercado" em destaque), em vez de apagar o
// destaque assim que a URL deixa de ser exatamente igual ao link da aba —
// que era o comportamento anterior (`pathname === to`).
//
// Função pura para poder testar as regras de prefixo isoladamente do
// componente, mesmo padrão de `filterDestinationsByCategory`/
// `filterPostsByTab` já usado no projeto.
const NAV_KEY_PREFIXES: Record<NavKey, string[]> = {
  home: ["/"],
  search: ["/busca"],
  explore: ["/explorar", "/destino"],
  market: ["/marketplace", "/mercado", "/parceiro", "/compliance", "/admin", "/eventos"],
  community: ["/comunidade"],
  profile: [
    "/perfil",
    "/configuracoes",
    "/amigos",
    "/atividade",
    "/checklist",
    "/notificacoes",
    "/login",
    "/cadastro",
    "/redefinir-senha",
  ],
};

export function getActiveNavKey(pathname: string): NavKey | null {
  if (pathname === "/") return "home";
  for (const [key, prefixes] of Object.entries(NAV_KEY_PREFIXES) as [NavKey, string[]][]) {
    if (key === "home") continue;
    if (prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      return key as NavKey;
    }
  }
  return null;
}

export function BottomNav() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { t } = useTranslation();

  // Indicador de atividade em andamento: verifica periodicamente se há
  // atividade ativa persistida localmente, para exibir um ponto pulsante
  // no ícone de Perfil (onde vive a rota /atividade/rastrear).
  const [hasActiveTracking, setHasActiveTracking] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const check = () => {
      loadActive().then((p) => {
        if (cancelled) return;
        setHasActiveTracking(
          p != null &&
          !("corrupted" in p) &&
          (p.status === "tracking" || p.status === "paused")
        );
      });
    };
    check();
    const interval = setInterval(check, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const activeKey = getActiveNavKey(pathname);

  const tabs: Array<{ key: NavKey; to: string; label: string; icon: typeof Home }> = [
    { key: "home", to: "/", label: t("nav.home"), icon: Home },
    { key: "search", to: "/busca", label: t("nav.search"), icon: Search },
    { key: "explore", to: "/explorar", label: t("nav.explore"), icon: Compass },
    { key: "market", to: "/eventos", label: t("nav.events", "Eventos"), icon: CalendarDays },
    { key: "community", to: "/comunidade", label: t("nav.community"), icon: Users },
    { key: "profile", to: user ? (hasActiveTracking ? "/atividade/rastrear" : "/perfil") : "/login", label: t("nav.profile"), icon: User },
  ];

  // Comportamento pedido pelo usuário: tocar na aba em que você já está
  // rola o conteúdo de volta ao topo (mesmo comportamento do Instagram),
  // em vez de não fazer nada.
  const handleTabClick = (key: NavKey, e: React.MouseEvent) => {
    if (key !== activeKey) return;
    e.preventDefault();
    document.getElementById("app-scroll-container")?.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <nav className="sticky bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-6 px-2 pt-2 pb-2">
        {tabs.map(({ key, to, label, icon: Icon }) => {
          const active = key === activeKey;
          return (
            <li key={to}>
              <Link
                to={to}
                onClick={(e) => handleTabClick(key, e)}
                className="flex flex-col items-center gap-1 py-1.5 transition-base active:scale-90"
              >
                <span
                  className={`relative flex h-9 w-12 items-center justify-center rounded-full transition-base ${
                    active ? "bg-primary/10 text-primary" : "text-muted-foreground"
                  }`}
                >
                  <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
                  {key === "profile" && hasActiveTracking && (
                    <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 ring-2 ring-card animate-pulse" />
                  )}
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
