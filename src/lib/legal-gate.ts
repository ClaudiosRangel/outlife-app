// Lógica pura de decisão do gate de aceite legal.
// Sem dependências de React/Supabase para ser testável isoladamente.

/** Rotas onde o gate NUNCA deve aparecer (públicas / de saída). */
export const LEGAL_GATE_EXEMPT_PATHS = [
  "/login",
  "/cadastro",
  "/termos",
  "/privacidade",
  "/redefinir-senha",
];

export function isExemptPath(pathname: string): boolean {
  return LEGAL_GATE_EXEMPT_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

/**
 * Decide se o modal de aceite deve bloquear o app.
 * Mostra quando: há usuário logado, a rota não é isenta, e a versão aceita
 * difere da versão vigente.
 */
export function shouldShowLegalGate(params: {
  isAuthenticated: boolean;
  acceptedVersion: string | null | undefined;
  currentVersion: string;
  pathname: string;
}): boolean {
  const { isAuthenticated, acceptedVersion, currentVersion, pathname } = params;
  if (!isAuthenticated) return false;
  if (isExemptPath(pathname)) return false;
  return acceptedVersion !== currentVersion;
}
