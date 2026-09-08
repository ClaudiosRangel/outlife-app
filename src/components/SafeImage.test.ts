import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { nextImageSrcOnError } from "@/components/SafeImage";

describe("nextImageSrcOnError — fallback idempotente (Property 4)", () => {
  it("aplica o fallback na primeira falha", () => {
    const r = nextImageSrcOnError({ currentSrc: "a.jpg", fallbackSrc: "fb.jpg", didFallback: false });
    expect(r).toEqual({ src: "fb.jpg", didFallback: true });
  });

  it("não reaplica o fallback se já houve fallback", () => {
    const r = nextImageSrcOnError({ currentSrc: "fb.jpg", fallbackSrc: "fb.jpg", didFallback: true });
    expect(r).toEqual({ src: "fb.jpg", didFallback: true });
  });

  it("mantém a src quando não há fallback", () => {
    const r = nextImageSrcOnError({ currentSrc: "a.jpg", fallbackSrc: undefined, didFallback: false });
    expect(r).toEqual({ src: "a.jpg", didFallback: false });
  });

  it("não troca quando o fallback é igual à src atual (evita loop)", () => {
    const r = nextImageSrcOnError({ currentSrc: "same.jpg", fallbackSrc: "same.jpg", didFallback: false });
    expect(r).toEqual({ src: "same.jpg", didFallback: false });
  });

  it("Property 4: nunca aplica fallback mais de uma vez em erros sucessivos", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.integer({ min: 1, max: 5 }),
        (src, fallback, errorCount) => {
          fc.pre(src !== fallback);
          let state = { src, didFallback: false };
          let fallbackApplications = 0;
          for (let i = 0; i < errorCount; i++) {
            const before = state.didFallback;
            state = nextImageSrcOnError({
              currentSrc: state.src,
              fallbackSrc: fallback,
              didFallback: state.didFallback,
            });
            if (!before && state.didFallback) fallbackApplications += 1;
          }
          // O fallback é aplicado no máximo uma vez, independentemente de
          // quantos erros ocorram.
          expect(fallbackApplications).toBeLessThanOrEqual(1);
          expect(state.src).toBe(fallback);
        },
      ),
    );
  });
});
