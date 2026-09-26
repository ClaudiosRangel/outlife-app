import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { elapsedFromPoints, elapsedTotalSeconds } from "@/lib/activity-duration";

describe("elapsedFromPoints", () => {
  it("retorna 0 para vazio ou 1 ponto", () => {
    expect(elapsedFromPoints([])).toBe(0);
    expect(elapsedFromPoints([{ ts: 1000 }])).toBe(0);
  });

  it("calcula o span entre 1º e último ponto (segundos)", () => {
    expect(elapsedFromPoints([{ ts: 1_000 }, { ts: 61_000 }])).toBe(60);
  });

  it("nunca negativo para timestamps decrescentes", () => {
    expect(elapsedFromPoints([{ ts: 61_000 }, { ts: 1_000 }])).toBe(0);
  });
});

describe("elapsedTotalSeconds", () => {
  it("usa o tempo de relógio quando startedAt é válido", () => {
    // início em 0, fim em 100s, pontos cobrindo só 40s → total = 100
    const pts = [{ ts: 10_000 }, { ts: 50_000 }];
    expect(elapsedTotalSeconds(0, 100_000, pts)).toBe(100);
  });

  it("cai para o span dos pontos quando startedAt é null (retrocompat)", () => {
    const pts = [{ ts: 10_000 }, { ts: 70_000 }]; // 60s
    expect(elapsedTotalSeconds(null, 999_999, pts)).toBe(60);
  });

  it("cai para o span dos pontos quando startedAt/endMs são inválidos", () => {
    const pts = [{ ts: 0 }, { ts: 30_000 }]; // 30s
    expect(elapsedTotalSeconds(Number.NaN, 100_000, pts)).toBe(30);
    expect(elapsedTotalSeconds(0, Number.POSITIVE_INFINITY, pts)).toBe(30);
  });

  it("nunca fica abaixo do span dos pontos (piso)", () => {
    // relógio diz 10s, mas os pontos cobrem 40s → total = 40 (piso)
    const pts = [{ ts: 0 }, { ts: 40_000 }];
    expect(elapsedTotalSeconds(0, 10_000, pts)).toBe(40);
  });

  it("retorna 0 quando fim < início e sem pontos úteis", () => {
    expect(elapsedTotalSeconds(100_000, 0, [])).toBe(0);
  });

  // Property 1: não-negatividade e finitude
  it("Property 1: sempre inteiro >= 0, nunca NaN/Infinity", () => {
    fc.assert(
      fc.property(
        fc.option(fc.integer({ min: 0, max: 10 ** 12 }), { nil: null }),
        fc.integer({ min: 0, max: 10 ** 12 }),
        fc.array(fc.record({ ts: fc.integer({ min: 0, max: 10 ** 12 }) })),
        (startedAt, end, pts) => {
          const v = elapsedTotalSeconds(startedAt, end, pts);
          return Number.isInteger(v) && v >= 0 && Number.isFinite(v);
        },
      ),
    );
  });

  // Property 3: total sempre >= span dos pontos
  it("Property 3: total >= elapsedFromPoints", () => {
    fc.assert(
      fc.property(
        fc.option(fc.integer({ min: 0, max: 10 ** 12 }), { nil: null }),
        fc.integer({ min: 0, max: 10 ** 12 }),
        fc.array(fc.record({ ts: fc.integer({ min: 0, max: 10 ** 12 }) })),
        (startedAt, end, pts) => {
          return elapsedTotalSeconds(startedAt, end, pts) >= elapsedFromPoints(pts);
        },
      ),
    );
  });

  // Property 4: imunidade à suspensão do timer — depende só do relógio.
  // Para startedAt válido e end >= startedAt cobrindo mais que o span,
  // o resultado reflete o relógio (não um contador que teria congelado).
  it("Property 4: reflete o relógio (start..end) quando este domina o span", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 ** 9 }),
        fc.integer({ min: 0, max: 10 ** 6 }),
        (startedAt, deltaSec) => {
          const end = startedAt + deltaSec * 1000;
          // sem pontos → o total é exatamente o relógio
          return elapsedTotalSeconds(startedAt, end, []) === deltaSec;
        },
      ),
    );
  });
});
