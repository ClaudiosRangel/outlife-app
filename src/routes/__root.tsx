import { createRootRouteWithContext, HeadContent, Link, Outlet, Scripts, useRouter } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Analytics } from "@vercel/analytics/react";
import { Toaster } from "sonner";
import { useEffect, useState } from "react";
import { reportErrorToSentry } from "@/lib/report-error-client";
import appCss from "../styles.css?url";
import { PhoneFrame } from "@/components/PhoneFrame";
import { BottomNav } from "@/components/BottomNav";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { AuthProvider } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { registerPushNotificationTapNavigation } from "@/lib/push-registration";
import { useLocalPushNotifications } from "@/hooks/use-local-push";
import { useKeyboardScroll } from "@/hooks/use-keyboard-scroll";
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

/**
 * Bug corrigido (usuário relatou: campos de input travando/não aceitando
 * digitação — reproduzia tanto no APK quanto no Chrome desktop usando o
 * mesmo bundle do SPA_Build_Target). Causa raiz: `RouterProvider` (usado
 * puro em `entry-native.tsx`, sem o framework TanStack Start) SEMPRE
 * renderiza `shellComponent` da rota raiz, independente do entry point —
 * não é um comportamento exclusivo do SSR (confirmado no código-fonte de
 * `@tanstack/react-router`, `Match.js`). No SPA_Build_Target,
 * `entry-native.tsx` já monta a árvore dentro de `<div id="root">` de um
 * `index.html` próprio (que já tem seu próprio `<html><head><body>`).
 * Sem esta checagem, `RootShell` gerava um segundo `<html><head><body>`
 * ANINHADO dentro dessa div — documento HTML inválido (dois `<body>`, um
 * deles dentro de uma `<div>`), que corrompe o cálculo de foco/IME de
 * WebViews Android (e reproduz até em Chrome desktop puro, pois o problema
 * está na estrutura do DOM montada pelo próprio bundle, não no WebView).
 *
 * No SPA_Build_Target o `<html>/<head>/<body>` real já vem do
 * `index.html` estático — aqui só é necessário renderizar os filhos
 * diretamente, sem wrapper.
 */
function RootShell({ children }: { children: React.ReactNode }) {
  if (import.meta.env.VITE_BUILD_TARGET === "native-spa") {
    return <>{children}</>;
  }
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

/**
 * HISTÓRICO — duas tentativas anteriores de resolver o comportamento do
 * teclado dentro do Outlife_Native_Shell (Android) tentaram fazer a
 * WebView encolher (`windowSoftInputMode="adjustResize"` +
 * `Keyboard.setResizeMode({ mode: Native })`) e então rolar
 * programaticamente o campo focado para dentro do espaço restante — 1ª
 * tentativa com `scrollIntoView`, 2ª com cálculo manual de `scrollTo`
 * restrito ao `#app-scroll-container`. As DUAS tentativas reproduziram o
 * mesmo bug reportado pelo usuário: o `<BottomNav>` (último elemento do
 * documento) "subia" e aparecia colado no topo da tela, embaixo da barra
 * de status, escondendo o campo atrás dele.
 *
 * Causa raiz de fundo (não é só o método de rolagem — é a arquitetura
 * resize+scroll em si): `adjustResize` redimensiona a JANELA nativa
 * enquanto o teclado abre, e esse redimensionamento é assíncrono e
 * concorrente com qualquer scroll JS disparado no mesmo instante (evento
 * `focusin`). Cada tentativa de calcular "quanto rolar" partia de uma
 * medição (`getBoundingClientRect`) tirada num momento em que a janela
 * ainda podia estar no meio da transição de tamanho — o que fazia o
 * cálculo errar e rolar o documento inteiro em vez do container interno.
 * Depurar caso a caso esse tipo de corrida entre resize nativo e JS não é
 * confiável.
 *
 * SOLUÇÃO (comportamento do Instagram, comparado lado a lado no mesmo
 * celular pelo usuário): abandonar `adjustResize` totalmente. A Activity
 * agora usa `windowSoftInputMode="adjustNothing"` (AndroidManifest.xml) —
 * o teclado aparece como um OVERLAY por cima do conteúdo, sem redimensionar
 * a janela nem a WebView. Não há mais nenhum resize para disparar scroll
 * nenhum, então não existe mais janela de corrida nem necessidade de JS
 * de compensação (os dois hooks `useKeyboardResize`/
 * `useScrollFocusedFieldIntoView`, e a dependência `@capacitor/keyboard`,
 * foram removidos). Os formulários de login/cadastro têm os campos na
 * parte superior/central da tela (ver login.tsx, cadastro.tsx) — o
 * teclado, ao cobrir só a parte inferior, nunca esconde o texto sendo
 * digitado, exatamente como no Instagram.
 */

/**
 * Requirement 11.5: navega para `/notificacoes` quando o usuário
 * seleciona uma Push_Notification (Web Push, fora do Outlife_Native_Shell).
 * `public/sw.js` já tenta focar/navegar a aba diretamente no
 * `notificationclick`; este listener cobre o caso em que o app já está
 * aberto e em foreground, recebendo a mensagem via `postMessage` do
 * service worker e navegando no lado do cliente (sem recarregar a página).
 */
function useServiceWorkerNotificationNavigation() {
  const router = useRouter();
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "outlife-notification-click" && typeof event.data.url === "string") {
        router.navigate({ to: event.data.url });
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, [router]);
}

/**
 * Requirement 11.5: navega para `/notificacoes` ao tocar numa
 * Push_Notification nativa (dentro do Outlife_Native_Shell). Registrado
 * uma única vez na montagem do componente raiz.
 */
function useNativePushNotificationNavigation() {
  const router = useRouter();
  useEffect(() => {
    registerPushNotificationTapNavigation((url) => router.navigate({ to: url }));
  }, [router]);
}

/**
 * Indicador de versão/build instalada (pedido do usuário: "seria
 * interessante ter a versão build para ver se estamos rodando corretamente
 * as correções"). Colocado aqui, no componente raiz, em vez de uma tela
 * específica (login/configurações) — a primeira tentativa (na tela de
 * login) falhou na prática porque um usuário já autenticado nunca vê essa
 * tela, já entra direto na Home. Renderizado como um selo fixo no topo,
 * visível em QUALQUER tela do app, logado ou não. Só faz sentido dentro do
 * Outlife_Native_Shell — fora dele não há um "APK instalado" para
 * versionar dessa forma.
 */
function useAppVersionBadge(): string | null {
  const [appVersion, setAppVersion] = useState<string | null>(null);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    App.getInfo()
      .then((info) => setAppVersion(`${info.version} (build ${info.build})`))
      .catch(() => {
        // Falha ao ler a versão nunca deve impedir o restante do app.
      });
  }, []);
  return appVersion;
}

/**
 * Deep Link: quando o app é aberto via link (App Links / intent scheme),
 * navega para a rota correspondente. Ex: https://outlife-app.vercel.app/a/xxx
 * ou outlife://atividade/xxx → navega para /atividade/$activityId.
 *
 * Também trata links de auth do Supabase (confirmação de e-mail, redefinição
 * de senha): quando o link contém hash fragments com tokens de sessão
 * (#access_token=...&type=recovery), extrai esses parâmetros e os passa ao
 * supabase-js para estabelecer a sessão de auth corretamente dentro do
 * WebView nativo — sem isso, o WebView não recebe o hash e o fluxo trava.
 */
function useDeepLinkNavigation() {
  const router = useRouter();
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    App.addListener("appUrlOpen", async (event) => {
      try {
        const url = new URL(event.url);

        // --- Auth callback: Supabase envia tokens via hash fragment ---
        // Formato: https://outlife-app.vercel.app/redefinir-senha#access_token=...&type=recovery
        // Ou:      https://outlife-app.vercel.app/#access_token=...&type=signup
        const hash = url.hash?.startsWith("#") ? url.hash.slice(1) : "";
        if (hash && hash.includes("access_token")) {
          const params = new URLSearchParams(hash);
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");

          if (accessToken && refreshToken) {
            // Estabelece a sessão de auth no supabase-js com os tokens do link
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            // Navega para o path do link (ex: /redefinir-senha).
            // O listener do AuthProvider (use-auth.tsx) já trata o evento
            // PASSWORD_RECOVERY e redireciona se necessário, mas navegamos
            // diretamente para garantir.
            const targetPath = url.pathname && url.pathname !== "/" ? url.pathname : "/";
            const type = params.get("type");
            if (type === "recovery") {
              router.navigate({ to: "/redefinir-senha" });
            } else if (targetPath !== "/") {
              router.navigate({ to: targetPath });
            }
            return;
          }
        }

        // --- Links /a/:id → redireciona para /atividade/:id ---
        const aMatch = url.pathname.match(/^\/a\/(.+)$/);
        if (aMatch) {
          router.navigate({ to: "/atividade/$activityId", params: { activityId: aMatch[1] } });
          return;
        }
        // Qualquer outro path, navega direto
        if (url.pathname && url.pathname !== "/") {
          router.navigate({ to: url.pathname });
        }
      } catch {
        // intent:// scheme ou custom scheme - parse manual
        const schemeMatch = event.url.match(/outlife:\/\/atividade\/(.+)/);
        if (schemeMatch) {
          router.navigate({ to: "/atividade/$activityId", params: { activityId: schemeMatch[1] } });
          return;
        }
        // Custom scheme auth: outlife://auth/#access_token=...&type=recovery
        const authSchemeMatch = event.url.match(/outlife:\/\/auth\/(.*)/);
        if (authSchemeMatch) {
          const fragment = authSchemeMatch[1].startsWith("#") ? authSchemeMatch[1].slice(1) : authSchemeMatch[1];
          if (fragment && fragment.includes("access_token")) {
            const params = new URLSearchParams(fragment);
            const accessToken = params.get("access_token");
            const refreshToken = params.get("refresh_token");
            if (accessToken && refreshToken) {
              supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(() => {
                const type = params.get("type");
                if (type === "recovery") {
                  router.navigate({ to: "/redefinir-senha" });
                }
              });
            }
          }
        }
      }
    });
  }, [router]);
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useRegisterServiceWorker();
  useServiceWorkerNotificationNavigation();
  useNativePushNotificationNavigation();
  useLocalPushNotifications();
  useDeepLinkNavigation();
  useKeyboardScroll();
  const appVersion = useAppVersionBadge();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PhoneFrame>
          {/* `h-full` + `min-h-0`: dentro de um contêiner flex, um filho
              flex (`<main>` com `flex-1`) só encolhe corretamente e passa a
              rolar internamente se o próprio pai tiver altura definida —
              sem isso, o flex item cresce para caber TODO o conteúdo (efeito
              contrário ao pretendido). `min-h-0` sobrescreve o mínimo
              implícito do flexbox que, por padrão, também impede o encolhimento. */}
          <div className="flex h-full min-h-0 flex-col">
            {/* id usado por BottomNav para rolar de volta ao topo ao tocar
                na aba em que você já está (comportamento do Instagram).
                `min-h-0` aqui é o que efetivamente contém a rolagem dentro
                de <main>, mantendo o BottomNav sempre visível abaixo,
                independente de quantos posts/itens a lista tiver. */}
            <main id="app-scroll-container" className="min-h-0 flex-1 overflow-y-auto pb-2">
              <Outlet />
            </main>
            <BottomNav />
          </div>
          {appVersion && (
            <div className="pointer-events-none absolute left-0 right-0 top-0 z-50 flex justify-center">
              <span className="rounded-b-md bg-black/60 px-2 py-0.5 text-[10px] text-white">
                {appVersion}
              </span>
            </div>
          )}
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
