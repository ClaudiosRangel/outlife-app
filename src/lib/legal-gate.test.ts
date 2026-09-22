import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { shouldShowLegalGate, isExemptPath, LEGAL_GATE_EXEMPT_PATHS } from "./legal-gate";

const V = "2026-09-15";

describe("legal-gate", () => {
  it("não mostra quando deslogado, em qualquer rota/versão", () => {
    fc.assert(
      fc.property(fc.string(), fc.option(fc.string(), { nil: null }), (pathname, accepted) => {
        expect(
          shouldShowLegalGate({ isAuthenticated: false, acceptedVersion: accepted, currentVersion: V, pathname }),
        ).toBe(false);
      }),
    );
  });

  it("não mostra em rotas isentas mesmo logado e sem aceite", () => {
    for (const p of LEGAL_GATE_EXEMPT_PATHS) {
      expect(
        shouldShowLegalGate({ isAuthenticated: true, acceptedVersion: null, currentVersion: V, pathname: p }),
      ).toBe(false);
    }
  });

  it("mostra quando logado, rota não isenta e versão diverge (null ou antiga)", () => {
    expect(
      shouldShowLegalGate({ isAuthenticated: true, acceptedVersion: null, currentVersion: V, pathname: "/perfil" }),
    ).toBe(true);
    expect(
      shouldShowLegalGate({ isAuthenticated: true, acceptedVersion: "2025-01-01", currentVersion: V, pathname: "/comunidade" }),
    ).toBe(true);
  });

  it("não mostra quando a versão aceita é igual à vigente", () => {
    fc.assert(
      fc.property(fc.constantFrom("/perfil", "/comunidade", "/explorar", "/"), (pathname) => {
        expect(
          shouldShowLegalGate({ isAuthenticated: true, acceptedVersion: V, currentVersion: V, pathname }),
        ).toBe(false);
      }),
    );
  });

  it("isExemptPath cobre subrotas isentas", () => {
    expect(isExemptPath("/termos")).toBe(true);
    expect(isExemptPath("/privacidade")).toBe(true);
    expect(isExemptPath("/perfil")).toBe(false);
  });
});
