import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import {
  computeElevationGain,
  createElevationGainState,
  pushElevationSample,
  DEFAULT_GAIN_THRESHOLD_M,
  type ElevationSample,
} from "./elevation-gain";

describe("computeElevationGain — casos determinísticos", () => {
  it("sequência vazia ou com uma amostra → ganho 0", () => {
    expect(computeElevationGain([])).toBe(0);
    expect(computeElevationGain([{ altitude: 100 }])).toBe(0);
  });

  it("ignora altitude ausente/inválida sem lançar", () => {
    const samples: ElevationSample[] = [
      { altitude: null },
      { altitude: undefined },
      { altitude: NaN },
      { altitude: 100 },
    ];
    expect(computeElevationGain(samples)).toBe(0);
  });

  it("micro-oscilações de GPS abaixo do threshold NÃO acumulam (o ponto da TASK 3)", () => {
    // Ruído de ±3m em torno de 100m, sem tendência: não deve creditar nada
    // (antes, com threshold de 2m, isso somaria dezenas de metros falsos).
    const samples: ElevationSample[] = [];
    const noise = [0, 3, -2, 2, -3, 1, -1, 3, -2, 2, -3, 0];
    for (const n of noise) samples.push({ altitude: 100 + n });
    // Com janela de suavização + threshold 10m, nenhuma subida sustentada.
    expect(computeElevationGain(samples, { smoothingWindow: 3 })).toBeLessThan(1);
  });

  it("subida sustentada acima do threshold acumula aproximadamente o desnível", () => {
    // Sobe de 100 a 150 em passos de 5m (sem suavização, sem acurácia ruim).
    const samples: ElevationSample[] = [];
    for (let a = 100; a <= 150; a += 5) samples.push({ altitude: a });
    const gain = computeElevationGain(samples, { smoothingWindow: 1, thresholdMeters: 10 });
    // Deve estar próximo de 50m (a histerese pode reter até ~threshold no fim).
    expect(gain).toBeGreaterThan(30);
    expect(gain).toBeLessThanOrEqual(50);
  });

  it("descida pura não gera ganho", () => {
    const samples: ElevationSample[] = [];
    for (let a = 200; a >= 100; a -= 5) samples.push({ altitude: a });
    expect(computeElevationGain(samples, { smoothingWindow: 1 })).toBe(0);
  });

  it("descarta altitude de amostras com acurácia horizontal ruim", () => {
    const samples: ElevationSample[] = [
      { altitude: 100, accuracy: 5 },
      { altitude: 500, accuracy: 999 }, // outlier, deve ser ignorado
      { altitude: 105, accuracy: 5 },
    ];
    // Sem o outlier, não há subida >= 10m → ganho ~0.
    expect(computeElevationGain(samples, { smoothingWindow: 1, maxAccuracyMeters: 35 })).toBeLessThan(1);
  });

  it("subida + descida + subida credita as duas subidas (histerese)", () => {
    // 100 → 130 (sobe 30) → 110 (desce) → 140 (sobe 30 do vale 110)
    const up1 = [100, 110, 120, 130];
    const down = [125, 120, 115, 110];
    const up2 = [120, 130, 140];
    const samples = [...up1, ...down, ...up2].map((a) => ({ altitude: a }));
    const gain = computeElevationGain(samples, { smoothingWindow: 1, thresholdMeters: 10 });
    // ~30 (primeira) + ~30 (segunda a partir do vale 110) = ~60, com folga da histerese.
    expect(gain).toBeGreaterThan(40);
    expect(gain).toBeLessThanOrEqual(60);
  });
});

describe("elevation-gain — propriedades (fast-check)", () => {
  const altArb = fc.double({ min: 0, max: 4000, noNaN: true });

  it("ganho é sempre finito e não-negativo", () => {
    fc.assert(
      fc.property(fc.array(altArb, { maxLength: 200 }), (alts) => {
        const gain = computeElevationGain(alts.map((a) => ({ altitude: a })));
        expect(Number.isFinite(gain)).toBe(true);
        expect(gain).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  it("nunca superestima: ganho <= soma de TODAS as diferenças positivas brutas", () => {
    fc.assert(
      fc.property(fc.array(altArb, { minLength: 2, maxLength: 200 }), (alts) => {
        let rawPositive = 0;
        for (let i = 1; i < alts.length; i++) {
          const d = alts[i] - alts[i - 1];
          if (d > 0) rawPositive += d;
        }
        const gain = computeElevationGain(alts.map((a) => ({ altitude: a })), { smoothingWindow: 1 });
        // A suavização/histerese só pode reduzir o total bruto, nunca aumentar
        // (com folga numérica de ponto flutuante).
        expect(gain).toBeLessThanOrEqual(rawPositive + 1e-6);
      }),
    );
  });

  it("estado incremental == cálculo em lote (determinismo do streaming)", () => {
    fc.assert(
      fc.property(fc.array(altArb, { maxLength: 100 }), (alts) => {
        const samples = alts.map((a) => ({ altitude: a }));
        let st = createElevationGainState();
        for (const s of samples) st = pushElevationSample(st, s);
        expect(st.gain).toBeCloseTo(computeElevationGain(samples), 6);
      }),
    );
  });

  it("threshold maior nunca resulta em ganho maior (mais conservador)", () => {
    fc.assert(
      fc.property(fc.array(altArb, { maxLength: 120 }), (alts) => {
        const samples = alts.map((a) => ({ altitude: a }));
        const low = computeElevationGain(samples, { smoothingWindow: 1, thresholdMeters: 2 });
        const high = computeElevationGain(samples, { smoothingWindow: 1, thresholdMeters: DEFAULT_GAIN_THRESHOLD_M });
        expect(high).toBeLessThanOrEqual(low + 1e-6);
      }),
    );
  });
});
