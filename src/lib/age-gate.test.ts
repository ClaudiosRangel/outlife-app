import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { ageFromBirthDate, validateBirthDate, toISODate, MIN_AGE } from "./age-gate";

// Meio-dia LOCAL para evitar ambiguidade de fuso ao comparar com datas
// "YYYY-MM-DD" (que o construtor Date interpreta como meia-noite UTC).
const NOW = new Date(2026, 8, 25, 12, 0, 0); // 25/set/2026 12:00 local

describe("ageFromBirthDate", () => {
  it("calcula idade em anos completos", () => {
    expect(ageFromBirthDate("2000-01-01", NOW)).toBe(26);
    expect(ageFromBirthDate("2000-12-31", NOW)).toBe(25); // aniversário ainda não chegou
  });
  it("null para entrada inválida", () => {
    expect(ageFromBirthDate(null, NOW)).toBeNull();
    expect(ageFromBirthDate("xxxx", NOW)).toBeNull();
  });
});

describe("validateBirthDate", () => {
  it("aprova quem tem >= 13 anos", () => {
    const r = validateBirthDate("2010-01-01", NOW);
    expect(r.ok).toBe(true);
  });
  it("reprova < 13 anos com reason too_young", () => {
    const r = validateBirthDate("2020-01-01", NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("too_young");
  });
  it("reprova data no futuro", () => {
    const r = validateBirthDate("2030-01-01", NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("future");
  });
  it("reprova ausência", () => {
    expect(validateBirthDate(null, NOW).ok).toBe(false);
    expect(validateBirthDate("", NOW).ok).toBe(false);
  });
  it("exatamente 13 anos no aniversário é aprovado", () => {
    // Data local para casar com a leitura de componentes locais da lib.
    const r = validateBirthDate(new Date(2013, 8, 25), NOW);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.age).toBe(MIN_AGE);
  });
  it("13 anos menos um dia é reprovado", () => {
    const r = validateBirthDate(new Date(2013, 8, 26), NOW);
    expect(r.ok).toBe(false);
  });

  it("property: quem nasceu há >= 13 anos nunca é too_young", () => {
    fc.assert(
      fc.property(fc.integer({ min: 13, max: 100 }), (yearsAgo) => {
        const birthYear = NOW.getFullYear() - yearsAgo;
        const r = validateBirthDate(`${birthYear}-01-01`, NOW);
        // Nasceu em 1º/jan de um ano >= 13 anos atrás → sempre >= 13 no dia de hoje.
        expect(r.ok).toBe(true);
      }),
    );
  });
});

describe("toISODate", () => {
  it("formata YYYY-MM-DD com zero à esquerda", () => {
    expect(toISODate(1990, 0, 5)).toBe("1990-01-05");
    expect(toISODate(2001, 11, 25)).toBe("2001-12-25");
  });
});
