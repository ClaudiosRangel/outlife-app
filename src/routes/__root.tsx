import { createRootRouteWithContext, HeadContent, Link, Outlet, Scripts, useRouter } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Analytics } from "@vercel/analytics/react";
import { Toaster } from "sonner";
import { useEffect } from "react";
import { reportErrorToSentry } from "@/lib/report-error-client";
import appCss from "../styles.css?url";
import { PhoneFrame } from "@/components/PhoneFrame";
import { BottomNav } from "@/components/BottomNav";
import { AuthProvider } from "@/hooks/use-auth";
import "@/lib/i18n";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Página não encontrada</h2>
        <Link to="/" className="mt-6 inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  /**
   * Reporta o erro ao Error_Monitoring_Service (Sentry) com a rota atual
   * como tag (Requirement 9.1). `reportErrorToSentry` usa `createIsomorphicFn`
   * (ver src/lib/report-error-client.ts) para que apenas o client importe
   * @sentry/tanstackstart-react — no servidor é um no-op. Envolvido em
   * try/catch: uma falha ao reportar não deve impedir a UI de erro
   * amigável já existente de ser exibida (Requirement 9.3).
   */
  useEffect(() => {
    try {
      reportErrorToSentry(error, router.state.location.pathname);
    } catch (sentryError) {
      console.error("[OutLife] Falha ao reportar erro ao Sentry:", sentryError);
    }
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
      <div>
        <h1 className="text-xl font-semibold">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ocorreu um erro inesperado. Tente novamente em instantes.
        </p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Outlife — A vida não é só trilhar" },
      { name: "description", content: "Marketplace outdoor colaborativo. Conecte aventureiros, guias, pousadas e empresas do ecossistema A Vida Não É Só Trilhar." },
      { name: "theme-color", content: "#1c3d2a" },
      { property: "og:title", content: "Outlife — A vida não é só trilhar" },
      { property: "og:description", content: "Marketplace outdoor colaborativo. Conecte aventureiros, guias, pousadas e empresas do ecossistema A Vida Não É Só Trilhar." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "Outlife — A vida não é só trilhar" },
      { name: "twitter:description", content: "Marketplace outdoor colaborativo. Conecte aventureiros, guias, pousadas e empresas do ecossistema A Vida Não É Só Trilhar." },
      { property: "og:image", content: "/social-preview.png" },
      { name: "twitter:image", content: "/social-preview.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "icon", href: "/icons/icon-192.png" },
      { rel: "apple-touch-icon", href: "/icons/icon-192.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

/**
 * Registra o Service Worker mínimo (public/sw.js) para tornar a
 * OutLife_Application instalável como PWA (Requirement 7.2). A ausência de
 * suporte (`"serviceWorker" in navigator`) ou uma falha no registro é
 * silenciosamente ignorada — a aplicação continua funcionando normalmente
 * como app web comum, apenas sem a capacidade de instalação.
 */
function useRegisterServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Falha no registro não deve impedir o carregamento normal do app.
    });
  }, []);
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useRegisterServiceWorker();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PhoneFrame>
          <div className="flex min-h-screen sm:min-h-[860px] flex-col">
            <main className="flex-1 overflow-y-auto pb-2">
              <Outlet />
            </main>
            <BottomNav />
          </div>
        </PhoneFrame>
        <Toaster position="top-center" richColors />
        {/**
         * Vercel Analytics (Requirement 9.2). O componente <Analytics />
         * já falha silenciosamente por design da biblioteca caso o script
         * não carregue — não é necessário tratamento de erro adicional,
         * apenas garantir que ele não bloqueie a árvore de renderização
         * (Requirement 9.4).
         */}
        <Analytics />
      </AuthProvider>
    </QueryClientProvider>
  );
}
