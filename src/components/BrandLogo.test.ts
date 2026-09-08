import { describe, it, expect } from "vitest";
import { shouldShowLogoSymbol } from "@/components/BrandLogo";

describe("shouldShowLogoSymbol — fallback do BrandLogo (Property 3)", () => {
  it("mostra o símbolo quando há asset e a imagem não deu erro", () => {
    expect(shouldShowLogoSymbol({ hasAsset: true, imageErrored: false })).toBe(true);
  });

  it("não mostra o símbolo quando a imagem deu erro (cai para wordmark)", () => {
    expect(shouldShowLogoSymbol({ hasAsset: true, imageErrored: true })).toBe(false);
  });

  it("não mostra o símbolo quando não há asset (só wordmark textual)", () => {
    expect(shouldShowLogoSymbol({ hasAsset: false, imageErrored: false })).toBe(false);
    expect(shouldShowLogoSymbol({ hasAsset: false, imageErrored: true })).toBe(false);
  });
});
