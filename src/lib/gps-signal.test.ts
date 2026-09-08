import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  NO_SIGNAL_TIMEOUT_MS,
  deriveGpsSignal,
  pushAccuracy,
  type GpsSignalState,
} from "@/lib/gps-signal";

const MAX_ACC = 12;

describe("deriveGpsSignal — precedência determinística (Req 6.6, Property 8)", () => {
  it("sem_sinal tem precedência máxima (mesmo sem primeira fixação)", () => {
    const s = deriveGpsSignal({
      recentAccuracies: [5],
      msSinceLastSample: NO_SIGNAL_TIMEOUT_MS + 1,
      hasFirstAcceptedPoint: false,
      maxAccuracyMeters: MAX_ACC,
    });
    expect(s).toBe("sem_sinal");
  });

  it("aquisitando quando ainda não há primeira Accepted_Point (Req 6.4)", () => {
    const s = deriveGpsSignal({
      recentAccuracies: [5],
      msSinceLastSample: 100,
      hasFirstAcceptedPoint: false,
      maxAccuracyMeters: MAX_ACC,
    });
    expect(s).toBe("aquisitando");
  });

  it("fraco quando todas as acurácias recentes estão acima do limiar (Req 6.3)", () => {
    const s = deriveGpsSignal({
      recentAccuracies: [30, 40, 50],
      msSinceLastSample: 100,
      hasFirstAcceptedPoint: true,
      maxAccuracyMeters: MAX_ACC,
    });
    expect(s).toBe("fraco");
  });

  it("bom quando ao menos uma acurácia recente está dentro do limiar (Req 6.5)", () => {
    const s = deriveGpsSignal({
      recentAccuracies: [30, 10, 40],
      msSinceLastSample: 100,
      hasFirstAcceptedPoint: true,
      maxAccuracyMeters: MAX_ACC,
    });
    expect(s).toBe("bom");
  });

  it("fraco quando há fixação mas nenhuma acurácia finita na janela", () => {
    const s = deriveGpsSignal({
      recentAccuracies: [NaN, Infinity],
      msSinceLastSample: 100,
      hasFirstAcceptedPoint: true,
      maxAccuracyMeters: MAX_ACC,
    });
    expect(s).toBe("fraco");
  });

  it("Property 8: sempre retorna um dos quatro estados válidos", () => {
    const VALID: GpsSignalState[] = ["aquisitando", "bom", "fraco", "sem_sinal"];
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: 0, max: 200, noNaN: false }), { maxLength: 6 }),
        fc.integer({ min: 0, max: 20_000 }),
        fc.boolean(),
        fc.double({ min: 5, max: 20, noNaN: true }),
        (accs, ms, hasFix, maxAcc) => {
          const s = deriveGpsSignal({
            recentAccuracies: accs,
            msSinceLastSample: ms,
            hasFirstAcceptedPoint: hasFix,
            maxAccuracyMeters: maxAcc,
          });
          expect(VALID).toContain(s);
        },
      ),
    );
  });
});

describe("pushAccuracy", () => {
  it("mantém no máximo maxSize elementos", () => {
    let w: number[] = [];
    for (let i = 0; i < 10; i++) w = pushAccuracy(w, i, 5);
    expect(w).toHaveLength(5);
    expect(w[0]).toBe(5);
    expect(w[4]).toBe(9);
  });
});
