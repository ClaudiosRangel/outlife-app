import { describe, it, expect } from "vitest";
import {
  TERMS_VERSION,
  PRIVACY_VERSION,
  LEGAL_DOC_VERSION,
  getTermsDoc,
  getPrivacyDoc,
  _docs,
} from "./legal-content";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

describe("legal-content", () => {
  it("versões são datas ISO (YYYY-MM-DD)", () => {
    expect(TERMS_VERSION).toMatch(ISO_DATE);
    expect(PRIVACY_VERSION).toMatch(ISO_DATE);
    expect(LEGAL_DOC_VERSION).toMatch(ISO_DATE);
  });

  it("toda seção tem heading não-vazio e ao menos um parágrafo não-vazio", () => {
    for (const doc of Object.values(_docs)) {
      expect(doc.sections.length).toBeGreaterThan(0);
      for (const s of doc.sections) {
        expect(s.heading.trim().length).toBeGreaterThan(0);
        expect(s.body.length).toBeGreaterThan(0);
        for (const p of s.body) expect(p.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("paridade de seções entre PT e EN (Termos)", () => {
    expect(_docs.TERMS_PT.sections.length).toBe(_docs.TERMS_EN.sections.length);
  });

  it("paridade de seções entre PT e EN (Privacidade)", () => {
    expect(_docs.PRIVACY_PT.sections.length).toBe(_docs.PRIVACY_EN.sections.length);
  });

  it("getTermsDoc/getPrivacyDoc selecionam idioma por prefixo", () => {
    expect(getTermsDoc("en").title).toBe("Terms of Use");
    expect(getTermsDoc("en-US").title).toBe("Terms of Use");
    expect(getTermsDoc("pt-BR").title).toBe("Termos de Uso");
    expect(getTermsDoc("").title).toBe("Termos de Uso"); // fallback PT
    expect(getPrivacyDoc("en").title).toBe("Privacy Policy");
    expect(getPrivacyDoc("pt-BR").title).toBe("Política de Privacidade");
  });

  it("documentos carregam a versão correspondente", () => {
    expect(getTermsDoc("pt-BR").version).toBe(TERMS_VERSION);
    expect(getPrivacyDoc("pt-BR").version).toBe(PRIVACY_VERSION);
  });
});
