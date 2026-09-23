import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { elapsedFromPoints } from "./activity-duration";

describe("elapsedFromPoints", () => {
  it("0 para vazio ou 1 ponto", () => {
    expect(elapsedFromPoints([])).toBe(0);
    expect(elapsedFromPoints([{ ts: 1000 }])).toBe(0);
  });

  it("calcula segundos entre o primeiro e o último ts", () => {
    expect(elapsedFromPoints([{ ts: 0 }, { ts: 60_000 }])).toBe(60);
    expect(elapsedFromPoints([{ ts: 1_000 }, { ts: 5_000 }, { ts: 121_000 }])).toBe(120);
  });

  it("nunca negativo nem NaN/Infinity", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 10 ** 12 }), { maxLength: 50 }),
        (tsList) => {
          const pts = tsList.map((ts) => ({ ts }));
          const r = elapsedFromPoints(pts);
          expect(Number.isFinite(r)).toBe(true);
          expect(r).toBeGreaterThanOrEqual(0);
        },
      ),
    );
  });
});
