// Age gate (idade mínima) — regra exigida pelas lojas (App Store / Google
// Play). Funções puras e testáveis para calcular idade e validar a idade
// mínima a partir de uma data de nascimento.

/** Idade mínima permitida para cadastro (política do OutVitar / lojas). */
export const MIN_AGE = 13;
/** Idade máxima plausível — evita datas absurdas (ex.: 1900). */
export const MAX_AGE = 120;

/**
 * Calcula a idade em anos completos numa data de referência (default: hoje).
 * Retorna null para entrada inválida. Puro/testável.
 */
export function ageFromBirthDate(birth: Date | string | null | undefined, now: Date = new Date()): number | null {
  if (birth == null) return null;
  const d = birth instanceof Date ? birth : new Date(birth);
  if (Number.isNaN(d.getTime())) return null;
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export type AgeValidation =
  | { ok: true; age: number }
  | { ok: false; reason: "missing" | "invalid" | "future" | "too_young" | "too_old"; age: number | null };

/**
 * Valida uma data de nascimento contra a idade mínima. Retorna um resultado
 * tipado com o motivo da reprovação (para a UI escolher a mensagem).
 */
export function validateBirthDate(
  birth: Date | string | null | undefined,
  now: Date = new Date(),
  minAge = MIN_AGE,
): AgeValidation {
  if (birth == null || (typeof birth === "string" && birth.trim() === "")) {
    return { ok: false, reason: "missing", age: null };
  }
  const d = birth instanceof Date ? birth : new Date(birth);
  if (Number.isNaN(d.getTime())) return { ok: false, reason: "invalid", age: null };
  if (d.getTime() > now.getTime()) return { ok: false, reason: "future", age: null };
  const age = ageFromBirthDate(d, now);
  if (age == null) return { ok: false, reason: "invalid", age: null };
  if (age > MAX_AGE) return { ok: false, reason: "too_old", age };
  if (age < minAge) return { ok: false, reason: "too_young", age };
  return { ok: true, age };
}

/** Formata uma data como YYYY-MM-DD (para gravar em coluna `date` do Postgres). */
export function toISODate(y: number, monthIndex0: number, day: number): string {
  const mm = String(monthIndex0 + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}
