import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { fetchMyLegalStatus, fetchMyProfile, getCachedLegalAccepted, touchLastSeen } from "@/lib/api";
import { WelcomeSplash } from "@/components/WelcomeSplash";
import { LEGAL_DOC_VERSION } from "@/lib/legal-content";
import { isPublicPath, resolveAuthRedirect } from "@/lib/auth-guard";

/** Gênero e data de nascimento preenchidos = cadastro completo. */
export function isProfileComplete(profile: unknown): boolean {
  const p = profile as { birth_date?: string | null; gender?: string | null } | null;
  return !!p && !!p.birth_date && !!p.gender;
}

/**
 * Portão de acesso: sem login só as telas públicas (login, cadastro, termos,
 * etc.). Logado: termos → completar cadastro → app. Deve ficar dentro do
 * AuthProvider e do QueryClientProvider.
 */
export function useAuthGate() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { pathname } = useLocation();

  const { data: legal } = useQuery({
    queryKey: ["my-legal-status", user?.id],
    queryFn: fetchMyLegalStatus,
    enabled: !!user && !loading,
    staleTime: 60_000,
  });
  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: fetchMyProfile,
    enabled: !!user && !loading,
  });

  // Aceite memorizado no aparelho vale mesmo com a rede oscilando (não tira o
  // usuário da gravação para a tela de termos).
  const cachedAccepted = user ? getCachedLegalAccepted(user.id) === LEGAL_DOC_VERSION : false;
  const termsAccepted = cachedAccepted
    ? true
    : legal === undefined
      ? undefined
      : legal.acceptedVersion === LEGAL_DOC_VERSION;
  const profileComplete = profile === undefined ? undefined : isProfileComplete(profile);

  const redirectTo = resolveAuthRedirect({
    authLoading: loading,
    isAuthenticated: !!user,
    pathname,
    termsAccepted,
    profileComplete,
  });

  useEffect(() => {
    if (redirectTo && redirectTo !== pathname) {
      router.navigate({ to: redirectTo, replace: true });
    }
  }, [redirectTo, pathname, router]);

  // Bloqueia o conteúdo protegido enquanto a sessão carrega ou o redirect ocorre.
  const blocked = (loading && !isPublicPath(pathname)) || (!!redirectTo && redirectTo !== pathname);
  // Logado, termos aceitos e cadastro completo = está dentro do app (boas-vindas liberadas).
  const inApp = !!user && termsAccepted === true && profileComplete === true && !redirectTo;
  const fullName = (profile as { full_name?: string | null } | null | undefined)?.full_name ?? null;

  return { user, blocked, inApp, fullName };
}

const WELCOME_KEY = "outvitar:welcome-shown:";

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, blocked, inApp, fullName } = useAuthGate();
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  // Boas-vindas uma vez por abertura/login (sessionStorage zera ao fechar o app).
  useEffect(() => {
    if (!inApp || !user) return;
    try {
      if (sessionStorage.getItem(WELCOME_KEY + user.id)) return;
      sessionStorage.setItem(WELCOME_KEY + user.id, "1");
    } catch {
      /* sessionStorage indisponível: mostra mesmo assim */
    }
    setWelcomeOpen(true);
  }, [inApp, user]);

  // Último acesso: registra ao entrar e ao voltar para o primeiro plano
  // (o servidor limita a 1 gravação a cada 5 minutos).
  useEffect(() => {
    if (!user) return;
    void touchLastSeen();
    const onVisible = () => {
      if (document.visibilityState === "visible") void touchLastSeen();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [user]);

  if (blocked) return <div className="min-h-screen bg-background" aria-busy="true" />;
  return (
    <>
      {children}
      {welcomeOpen && <WelcomeSplash fullName={fullName} onDone={() => setWelcomeOpen(false)} />}
    </>
  );
}
