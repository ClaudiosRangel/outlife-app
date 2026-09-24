// Captura e aplicação do código de indicação (deep link / query `?ref=`).
//
// O código pode chegar por: query string na URL de instalação
// (`?ref=CODIGO`), deep link do app, ou digitação manual. Guardamos em
// localStorage assim que aparece, porque o cadastro pode exigir confirmação
// de e-mail (a sessão só existe depois). Quando houver sessão autenticada,
// `redeemPendingReferral()` aplica e confirma a indicação — idempotente no
// backend (só vincula/recompensa uma vez).

import { applyReferral, confirmReferral } from "@/lib/api";

const STORAGE_KEY = "outvitar_pending_ref";

/** Lê o código de indicação da URL atual (query `ref`), se houver. */
export function readReferralFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("ref");
    return code && code.trim() ? code.trim() : null;
  } catch {
    return null;
  }
}

/** Guarda um código de indicação pendente (sobrescreve só se vier um novo). */
export function storePendingReferral(code: string | null | undefined): void {
  if (typeof window === "undefined" || !code || !code.trim()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, code.trim().toUpperCase());
  } catch {
    /* ignore */
  }
}

/** Código de indicação pendente guardado, se houver. */
export function getPendingReferral(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

/** Limpa o código pendente (após aplicar). */
export function clearPendingReferral(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Se houver um código pendente e o usuário estiver autenticado, aplica e
 * confirma a indicação, depois limpa. Silencioso: falha não deve quebrar o
 * fluxo de cadastro/login. Retorna true se aplicou uma indicação nova.
 */
export async function redeemPendingReferral(): Promise<boolean> {
  const code = getPendingReferral();
  if (!code) return false;
  try {
    const applied = await applyReferral(code);
    // Confirma mesmo se apply retornou false (pode já estar pending de antes).
    await confirmReferral();
    clearPendingReferral();
    return applied;
  } catch {
    // Mantém o código guardado para tentar de novo numa próxima sessão.
    return false;
  }
}

/** Captura o `?ref=` da URL (se houver) e guarda como pendente. Chamar no boot. */
export function captureReferralFromUrl(): void {
  const code = readReferralFromUrl();
  if (code) storePendingReferral(code);
}
