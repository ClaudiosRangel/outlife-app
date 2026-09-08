import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { nextVideoStateOnError } from "@/components/SafeVideo";

describe("nextVideoStateOnError — queda para poster idempotente", () => {
  it("na primeira falha, passa a exibir o poster/fallback", () => {
    const r = nextVideoStateOnError({ didFail: false });
    expect(r).toEqual({ showPosterFallback: true, didFail: true });
  });

  it("em falhas subsequentes, permanece exibindo o poster (sem loop)", () => {
    const r = nextVideoStateOnError({ didFail: true });
    expect(r).toEqual({ showPosterFallback: true, didFail: true });
  });

  it("Property: após qualquer sequência de erros, o estado é estável (didFail=true, mostra poster)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 8 }), (errorCount) => {
        let state = { showPosterFallback: false, didFail: false };
        for (let i = 0; i < errorCount; i++) {
          state = nextVideoStateOnError({ didFail: state.didFail });
        }
        expect(state.didFail).toBe(true);
        expect(state.showPosterFallback).toBe(true);
      }),
    );
  });
});
