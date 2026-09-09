import { Link, useLocation } from "@tanstack/react-router";
import { Home, Compass, Users, User, CircleDot } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { loadActive } from "@/lib/activity-storage";

// Menu aprovado pelo usuário (padrão de mercado estilo Strava/Instagram):
// Início · Explorar · ⏺Gravar (botão central destacado) · Comunidade · Você.
// "Buscar" vive no topo da Home; "Eventos" é seção na Home e rota própria —
// ambos continuam acessíveis, só saíram da barra inferior para dar destaque à
// ação principal (Gravar atividade).
type NavKey = "home" | "explore" | "record" | "community" | "profile";

// A aba permanece ativa em qualquer sub-rota que pertença a ela (comportamento
// "Instagram"). Rotas que não têm mais aba própria na barra (busca, eventos,
// mercado, parceiro, compliance, admin) são associadas à aba mais próxima para
// não deixar a barra sem destaque: busca→home, eventos/mercado/parceiro→explore.
const NAV_KEY_PREFIXES: Record<NavKey, string[]> = {
  home: ["/", "/busca"],
  explore: ["/explorar", "/destino", "/eventos", "/marketplace", "/mercado", "/parceiro", "/compliance", "/admin"],
  record: ["/atividade"],
  community: ["/comunidade"],
  profile: [
    "/perfil",
    "/configuracoes",
    "/amigos",
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

  // Indicador de atividade em andamento: ponto pulsante no botão Gravar.
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
  const recordTo = user ? "/atividade/rastrear" : "/login";

  // Abas laterais (2 à esquerda, 2 à direita). O botão central Gravar é
  // renderizado separadamente, com destaque.
  const sideTabs: Array<{ key: NavKey; to: string; label: string; icon: typeof Home }> = [
    { key: "home", to: "/", label: t("nav.home"), icon: Home },
    { key: "explore", to: "/explorar", label: t("nav.explore"), icon: Compass },
    { key: "community", to: "/comunidade", label: t("nav.community"), icon: Users },
    { key: "profile", to: user ? "/perfil" : "/login", label: t("nav.you", "Você"), icon: User },
  ];
  const leftTabs = sideTabs.slice(0, 2);
  const rightTabs = sideTabs.slice(2);

  // Tocar na aba ativa rola o conteúdo ao topo (padrão Instagram).
  const handleTabClick = (key: NavKey, e: React.MouseEvent) => {
    if (key !== activeKey) return;
    e.preventDefault();
    document.getElementById("app-scroll-container")?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const renderTab = ({ key, to, label, icon: Icon }: { key: NavKey; to: string; label: string; icon: typeof Home }) => {
    const active = key === activeKey;
    return (
      <li key={to} className="flex-1">
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
          </span>
          <span className={`text-[10px] font-medium ${active ? "text-primary" : "text-muted-foreground"}`}>
            {label}
          </span>
        </Link>
      </li>
    );
  };

  return (
    <nav className="sticky bottom-0 left-0 right-0 z-40 pb-[env(safe-area-inset-bottom)]">
      <div className="relative">
        {/* A superfície da barra é um SVG que já vem com a CONCAVIDADE (curva
            côncava) recortada no topo, no centro — onde o botão Gravar se
            encaixa. Isso entalha a própria barra (sem caixinha solta e sem a
            linha reta atravessando o botão). O SVG usa currentColor = cor do
            card, respeitando tema claro/escuro. */}
        <svg
          className="absolute inset-0 h-full w-full text-card drop-shadow-[0_-2px_8px_rgba(0,0,0,0.06)]"
          preserveAspectRatio="none"
          viewBox="0 0 375 64"
          aria-hidden="true"
        >
          {/* Barra de 0..375 de largura, 64 de altura, com um "vão" côncavo
              centrado em x=187.5 e raio ~34. */}
          <path
            fill="currentColor"
            d="M0 12 C0 5.4 5.4 0 12 0 H150 C158 0 163 10 168 15 C173 20 180 24 187.5 24 C195 24 202 20 207 15 C212 10 217 0 225 0 H363 C369.6 0 375 5.4 375 12 V64 H0 Z"
          />
        </svg>

        <ul className="relative flex items-end px-2 pb-2 pt-3">
          {leftTabs.map(renderTab)}

          {/* Botão Gravar assentado DENTRO da concavidade (sobe metade para fora
              do vão). Anel da cor do card para fundir com o recorte. */}
          <li className="flex-1">
            <Link
              to={recordTo}
              aria-label={t("nav.record", "Gravar")}
              className="flex flex-col items-center gap-1 transition-base active:scale-90"
            >
              <span className="relative -mt-8 grid h-14 w-14 place-items-center rounded-full bg-[var(--sun,#E8821E)] text-white shadow-float ring-4 ring-card transition-base">
                <CircleDot size={26} strokeWidth={2.2} />
                {hasActiveTracking && (
                  <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-green-500 ring-2 ring-card animate-pulse" />
                )}
              </span>
              <span className="text-[10px] font-semibold text-foreground">{t("nav.record", "Gravar")}</span>
            </Link>
          </li>

          {rightTabs.map(renderTab)}
        </ul>
      </div>
    </nav>
  );
}
