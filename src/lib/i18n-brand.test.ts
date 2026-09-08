import { describe, it, expect } from "vitest";
import ptBR from "../../public/locales/pt-BR/translation.json";
import en from "../../public/locales/en/translation.json";

/** Coleta recursivamente todos os valores string de um objeto de tradução. */
function collectStrings(obj: unknown, out: string[] = []): string[] {
  if (typeof obj === "string") {
    out.push(obj);
  } else if (obj && typeof obj === "object") {
    for (const v of Object.values(obj as Record<string, unknown>)) {
      collectStrings(v, out);
    }
  }
  return out;
}

describe("i18n — rebranding OutVitar (Property 1)", () => {
  it("nenhuma string de tradução pt-BR contém 'Outlife'", () => {
    const offending = collectStrings(ptBR).filter((s) => /outlife/i.test(s));
    expect(offending).toEqual([]);
  });

  it("nenhuma string de tradução en contém 'Outlife'", () => {
    const offending = collectStrings(en).filter((s) => /outlife/i.test(s));
    expect(offending).toEqual([]);
  });

  it("o slogan oficial está definido em ambos os idiomas", () => {
    expect((ptBR as { brand: { slogan: string } }).brand.slogan).toBe(
      "VIVER É DIFERENTE DE ESTAR VIVO",
    );
    expect((en as { brand: { slogan: string } }).brand.slogan).toBe(
      "VIVER É DIFERENTE DE ESTAR VIVO",
    );
  });

  it("o nome da marca é OutVitar em ambos os idiomas", () => {
    expect((ptBR as { brand: { name: string } }).brand.name).toBe("OutVitar");
    expect((en as { brand: { name: string } }).brand.name).toBe("OutVitar");
  });
});
