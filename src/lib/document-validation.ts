// Validação pura de documentos brasileiros (spec parceiros-cadastros-completos,
// item 13). Dígito verificador REAL de CPF/CNPJ — não apenas formato/regex.
//
// Funções puras e totais (padrão do projeto): nunca lançam, tratam nulo/vazio/
// malformado retornando `false`/string vazia. Testáveis com Vitest + fast-check.

/** Remove tudo que não é dígito. Idempotente. */
export function onlyDigits(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/\D/g, "");
}

/** true quando todos os caracteres da string são o mesmo dígito (ex.: "11111111111"). */
function allSameDigit(digits: string): boolean {
  return digits.length > 0 && /^(\d)\1*$/.test(digits);
}

/**
 * Valida CPF por dígito verificador (aceita com ou sem máscara).
 * Regras: 11 dígitos, não todos iguais, dois dígitos verificadores corretos.
 */
export function isValidCPF(value: string | null | undefined): boolean {
  const d = onlyDigits(value);
  if (d.length !== 11 || allSameDigit(d)) return false;

  const calcCheck = (len: number): number => {
    let sum = 0;
    // Pesos decrescentes: para o 1º dígito, 10..2; para o 2º, 11..2.
    for (let i = 0; i < len; i++) {
      sum += Number(d[i]) * (len + 1 - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  const check1 = calcCheck(9);
  if (check1 !== Number(d[9])) return false;
  const check2 = calcCheck(10);
  return check2 === Number(d[10]);
}

/**
 * Valida CNPJ por dígito verificador (aceita com ou sem máscara).
 * Regras: 14 dígitos, não todos iguais, dois dígitos verificadores corretos.
 */
export function isValidCNPJ(value: string | null | undefined): boolean {
  const d = onlyDigits(value);
  if (d.length !== 14 || allSameDigit(d)) return false;

  const calcCheck = (len: number): number => {
    // Pesos do CNPJ: começam em 5 (1º dígito) / 6 (2º dígito) e decrescem até 2,
    // reciclando de 9 para 2.
    let weight = len - 7;
    let sum = 0;
    for (let i = 0; i < len; i++) {
      sum += Number(d[i]) * weight;
      weight = weight === 2 ? 9 : weight - 1;
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const check1 = calcCheck(12);
  if (check1 !== Number(d[12])) return false;
  const check2 = calcCheck(13);
  return check2 === Number(d[13]);
}

/** Valida o formato de CEP: exatamente 8 dígitos. */
export function isValidCEP(value: string | null | undefined): boolean {
  return onlyDigits(value).length === 8;
}

/** Máscara de CPF: 000.000.000-00. */
export function maskCPF(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Máscara de CNPJ: 00.000.000/0000-00. */
export function maskCNPJ(value: string): string {
  const d = onlyDigits(value).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Máscara de CEP: 00000-000. */
export function maskCEP(value: string): string {
  const d = onlyDigits(value).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}
