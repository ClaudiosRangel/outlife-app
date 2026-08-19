import { Capacitor } from "@capacitor/core";

/**
 * Domínio de produção do OutLife (usado pelo Supabase nos links de e-mail).
 * Dentro do WebView nativo do Capacitor, `window.location.origin` resolve
 * para `https://localhost` (o scheme interno do Capacitor), não para o
 * domínio real — portanto os links de confirmação de cadastro e recuperação
 * de senha gerados pelo Supabase apontariam para um endereço inexistente.
 *
 * Este módulo centraliza a lógica: se estamos no Capacitor, usa o domínio
 * de produção; caso contrário, usa `window.location.origin` (funciona
 * normalmente no navegador e em preview de staging).
 */
const PRODUCTION_ORIGIN = "https://outlife-app.vercel.app";

/**
 * Retorna a origin (base URL) que deve ser usada como `redirectTo` /
 * `emailRedirectTo` nas chamadas ao Supabase Auth.
 */
export function getAuthRedirectOrigin(): string {
  if (Capacitor.isNativePlatform()) {
    return PRODUCTION_ORIGIN;
  }
  return typeof window !== "undefined" ? window.location.origin : PRODUCTION_ORIGIN;
}

/**
 * Monta a URL completa de redirect para um path específico.
 * Ex: getAuthRedirectUrl("/redefinir-senha") → "https://outlife-app.vercel.app/redefinir-senha"
 */
export function getAuthRedirectUrl(path: string): string {
  const origin = getAuthRedirectOrigin();
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}
