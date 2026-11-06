import { useEffect, type ReactNode } from "react";
import { useLocation, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { fetchMyLegalStatus, fetchMyProfile } from "@/lib/api";
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

  const termsAccepted = legal === undefined ? undefined : legal.acceptedVersion === LEGAL_DOC_VERSION;
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
  return { user, blocked };
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { blocked } = useAuthGate();
  if (blocked) return <div className="min-h-screen bg-background" aria-busy="true" />;
  return <>{children}</>;
}
