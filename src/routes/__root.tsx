import { createRootRouteWithContext, HeadContent, Link, Outlet, Scripts, useRouter } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
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
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/66cbb4dd-aa00-477e-a243-2f0dd77824ba/id-preview-cf55184e--945c3d37-65f9-4aab-9491-f7643c449e90.lovable.app-1778852949865.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/66cbb4dd-aa00-477e-a243-2f0dd77824ba/id-preview-cf55184e--945c3d37-65f9-4aab-9491-f7643c449e90.lovable.app-1778852949865.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
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

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
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
      </AuthProvider>
    </QueryClientProvider>
  );
}
