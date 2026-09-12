import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { resolveBannerDescription, truncateForBanner } from "./banner-generator";

// Property 5 (Frente E): a descrição do banner usa a do usuário quando tem
// conteúdo real (não-vazio após trim); descrição vazia/whitespace cai no
// Default_Description. Nunca lança.
describe("resolveBannerDescription (Property 5 — P2)", () => {
  it("descrição vazia/whitespace usa o default", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^\s*$/),
        fc.string(),
        (blank, dflt) => {
          expect(resolveBannerDescription(blank, dflt)).toBe(dflt.trim());
        },
      ),
    );
  });

  it("descrição com conteúdo real prevalece sobre o default", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => s.trim().length > 0),
        fc.string(),
        (desc, dflt) => {
          expect(resolveBannerDescription(desc, dflt)).toBe(desc.trim());
        },
      ),
    );
  });

  it("null/undefined em ambos retorna string vazia (nunca lança)", () => {
    expect(resolveBannerDescription(null, null)).toBe("");
    expect(resolveBannerDescription(undefined, undefined)).toBe("");
    expect(resolveBannerDescription("   ", null)).toBe("");
  });
});

describe("truncateForBanner", () => {
  it("nunca excede maxLength + 1 (reticências) e preserva textos curtos", () => {
    fc.assert(
      fc.property(fc.string(), fc.integer({ min: 1, max: 300 }), (text, max) => {
        const out = truncateForBanner(text, max);
        if (text.length <= max) {
          expect(out).toBe(text);
        } else {
          expect(out.length).toBe(max + 1);
          expect(out.endsWith("…")).toBe(true);
        }
      }),
    );
  });
});
