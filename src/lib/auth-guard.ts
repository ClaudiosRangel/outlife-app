// Regras puras do portão de acesso do app (sem React/Supabase, testável).
//
// Fluxo exigido: o app só libera qualquer tela/menu depois do login inicial.
// Após logar: 1º Termos/Privacidade (modal LegalGate) → 2º completar o cadastro
// (gênero + data de nascimento) → só então o app.

/** Rotas acessíveis sem login. */
const PUBLIC_PATHS = [
  "/login",
  "/cadastro",
  "/redefinir-senha",
  "/email-confirmado",
  "/termos",
  "/privacidade",
];

/** Prefixos públicos: prévia de atividade compartilhada por link (/a/<id>). */
const PUBLIC_PREFIXES = ["/a/"];

/** Rotas em que o usuário logado NÃO deve ser redirecionado para completar perfil. */
const PROFILE_EXEMPT_PATHS = [
  "/completar-perfil",
  "/termos",
  "/privacidade",
  "/redefinir-senha",
  "/email-confirmado",
];

const matches = (pathname: string, p: string) => pathname === p || pathname.startsWith(p + "/");

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => matches(pathname, p)) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export type AuthGateInput = {
  /** Sessão ainda sendo restaurada. */
  authLoading: boolean;
  isAuthenticated: boolean;
  pathname: string;
  /** undefined = ainda carregando; true/false = resultado do aceite da versão vigente. */
  termsAccepted: boolean | undefined;
  /** undefined = ainda carregando; true quando gênero e data de nascimento existem. */
  profileComplete: boolean | undefined;
};

/**
 * Retorna para onde redirecionar, ou null para deixar a rota atual.
 */
export function resolveAuthRedirect(input: AuthGateInput): string | null {
  const { authLoading, isAuthenticated, pathname, termsAccepted, profileComplete } = input;
  if (authLoading) return null;

  if (!isAuthenticated) {
    return isPublicPath(pathname) ? null : "/login";
  }

  // Logado não precisa ver login/cadastro.
  if (pathname === "/login" || pathname === "/cadastro") return "/";

  // Ordem: termos (modal) antes do cadastro complementar.
  if (termsAccepted !== true) return null;

  if (profileComplete === false && !PROFILE_EXEMPT_PATHS.some((p) => matches(pathname, p))) {
    return "/completar-perfil";
  }
  return null;
}
