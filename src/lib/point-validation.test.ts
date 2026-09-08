import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { validatePoint, type RawSample, type ValidationRefState } from "@/lib/point-validation";
import { haversineMeters } from "@/lib/haversine";
import type { TrackingProfile } from "@/lib/tracking-config";

// Perfil de referência para os testes (mesma ordem de grandeza da caminhada).
const PROFILE: TrackingProfile = {
  maxAccuracyMeters: 12,
  minDistanceMeters: 1.5,
  maxSpeedMps: 4,
};

const ORIGIN = { lat: -22.9, lng: -43.2, ts: 1_000_000 };

/** Desloca uma coordenada ~metros ao norte (aprox. 1 grau lat = 111_320 m). */
function north(base: { lat: number; lng: number }, meters: number) {
  return { lat: base.lat + meters / 111_320, lng: base.lng };
}

describe("validatePoint — acurácia (Req 1)", () => {
  it("rejeita amostra com accuracy acima do limiar", () => {
    const sample: RawSample = { ...north(ORIGIN, 5), ts: ORIGIN.ts + 2000, accuracy: 30 };
    const res = validatePoint(sample, { lastAccepted: ORIGIN }, PROFILE, "reject");
    expect(res).toEqual({ accepted: false, reason: "accuracy" });
  });

  it("aceita amostra com accuracy exatamente no limiar (borda de igualdade)", () => {
    const sample: RawSample = { ...north(ORIGIN, 5), ts: ORIGIN.ts + 2000, accuracy: 12 };
    const res = validatePoint(sample, { lastAccepted: ORIGIN }, PROFILE, "reject");
    expect(res.accepted).toBe(true);
  });

  it("aplica missingAccuracyPolicy=reject quando accuracy ausente", () => {
    const sample: RawSample = { ...north(ORIGIN, 5), ts: ORIGIN.ts + 2000, accuracy: null };
    const res = validatePoint(sample, { lastAccepted: ORIGIN }, PROFILE, "reject");
    expect(res).toEqual({ accepted: false, reason: "missing_accuracy" });
  });

  it("aplica missingAccuracyPolicy=accept quando accuracy ausente (segue demais critérios)", () => {
    const sample: RawSample = { ...north(ORIGIN, 5), ts: ORIGIN.ts + 2000, accuracy: undefined };
    const res = validatePoint(sample, { lastAccepted: ORIGIN }, PROFILE, "accept");
    expect(res.accepted).toBe(true);
  });
});

describe("validatePoint — primeira origem (Req 2.6/5.3, Property 5)", () => {
  it("aceita a primeira amostra (sem lastAccepted) sem avaliar distância/velocidade", () => {
    const sample: RawSample = { lat: -22.9, lng: -43.2, ts: ORIGIN.ts, accuracy: 8 };
    const ref: ValidationRefState = { lastAccepted: null };
    expect(validatePoint(sample, ref, PROFILE, "reject").accepted).toBe(true);
  });

  it("aceita primeira origem mesmo com deslocamento que seria salto se houvesse referência", () => {
    // sem referência, o Speed_Ceiling não se aplica
    const sample: RawSample = { lat: 0, lng: 0, ts: ORIGIN.ts, accuracy: 8 };
    expect(validatePoint(sample, { lastAccepted: null }, PROFILE, "reject").accepted).toBe(true);
  });
});

describe("validatePoint — Speed_Ceiling (Req 2, Property 3/4)", () => {
  it("rejeita deslocamento que implica velocidade acima do teto", () => {
    // 100m em 1s = 100 m/s >> 4 m/s
    const sample: RawSample = { ...north(ORIGIN, 100), ts: ORIGIN.ts + 1000, accuracy: 5 };
    const res = validatePoint(sample, { lastAccepted: ORIGIN }, PROFILE, "reject");
    expect(res).toEqual({ accepted: false, reason: "speed_ceiling" });
  });

  it("rejeita quando dt <= 0 (timestamps iguais) sem dividir por zero (Req 2.4)", () => {
    const sample: RawSample = { ...north(ORIGIN, 5), ts: ORIGIN.ts, accuracy: 5 };
    const res = validatePoint(sample, { lastAccepted: ORIGIN }, PROFILE, "reject");
    expect(res).toEqual({ accepted: false, reason: "speed_ceiling" });
  });

  it("rejeita quando dt < 0 (timestamp fora de ordem)", () => {
    const sample: RawSample = { ...north(ORIGIN, 5), ts: ORIGIN.ts - 5000, accuracy: 5 };
    const res = validatePoint(sample, { lastAccepted: ORIGIN }, PROFILE, "reject");
    expect(res).toEqual({ accepted: false, reason: "speed_ceiling" });
  });

  it("aceita deslocamento plausível (2m em 2s = 1 m/s)", () => {
    const sample: RawSample = { ...north(ORIGIN, 2), ts: ORIGIN.ts + 2000, accuracy: 5 };
    expect(validatePoint(sample, { lastAccepted: ORIGIN }, PROFILE, "reject").accepted).toBe(true);
  });
});

describe("validatePoint — deslocamento mínimo (Req 3)", () => {
  it("rejeita deslocamento abaixo do mínimo (deriva com usuário parado)", () => {
    // 0,5m em 2s = 0,25 m/s (dentro do teto), mas < 1,5m mínimo
    const sample: RawSample = { ...north(ORIGIN, 0.5), ts: ORIGIN.ts + 2000, accuracy: 5 };
    const res = validatePoint(sample, { lastAccepted: ORIGIN }, PROFILE, "reject");
    expect(res).toEqual({ accepted: false, reason: "min_distance" });
  });

  it("aceita deslocamento igual ou acima do mínimo (Req 3.2)", () => {
    // north() usa um fator aproximado de metros→graus; para testar a borda de
    // aceitação de forma robusta, usamos um alvo cuja distância haversine REAL
    // é >= minDistanceMeters (verificada abaixo), evitando falso-negativo por
    // arredondamento do helper.
    const sample: RawSample = { ...north(ORIGIN, 1.6), ts: ORIGIN.ts + 3000, accuracy: 5 };
    expect(haversineMeters(ORIGIN, sample)).toBeGreaterThanOrEqual(PROFILE.minDistanceMeters);
    expect(validatePoint(sample, { lastAccepted: ORIGIN }, PROFILE, "reject").accepted).toBe(true);
  });
});

describe("validatePoint — propriedades de correção", () => {
  const coord = () =>
    fc.record({
      lat: fc.double({ min: -60, max: 60, noNaN: true }),
      lng: fc.double({ min: -180, max: 180, noNaN: true }),
      ts: fc.integer({ min: 0, max: 10_000_000 }),
      accuracy: fc.oneof(fc.constant(null), fc.double({ min: 0, max: 100, noNaN: true })),
    });

  it("Property 4/6: nunca lança e nunca retorna resultado inválido para qualquer entrada", () => {
    fc.assert(
      fc.property(coord(), coord(), fc.constantFrom<"accept" | "reject">("accept", "reject"), (a, b, pol) => {
        const res = validatePoint(a as RawSample, { lastAccepted: b as RawSample }, PROFILE, pol);
        expect(typeof res.accepted).toBe("boolean");
        if (!res.accepted) {
          expect(["accuracy", "missing_accuracy", "speed_ceiling", "min_distance"]).toContain(res.reason);
        }
      }),
    );
  });

  it("Property 5: sem lastAccepted, amostra com acurácia OK é sempre aceita", () => {
    fc.assert(
      fc.property(coord(), (a) => {
        const s = { ...(a as RawSample), accuracy: 5 };
        expect(validatePoint(s, { lastAccepted: null }, PROFILE, "reject").accepted).toBe(true);
      }),
    );
  });

  it("Property 3: velocidade estritamente acima do teto sempre rejeita por speed_ceiling", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 10, max: 500, noNaN: true }),
        fc.integer({ min: 1, max: 3 }),
        (meters, dtSec) => {
          // garante v > maxSpeedMps: meters/dt com meters grande e dt pequeno
          const sample: RawSample = { ...north(ORIGIN, meters), ts: ORIGIN.ts + dtSec * 1000, accuracy: 5 };
          const v = haversineMeters(ORIGIN, sample) / dtSec;
          fc.pre(v > PROFILE.maxSpeedMps);
          const res = validatePoint(sample, { lastAccepted: ORIGIN }, PROFILE, "reject");
          expect(res).toEqual({ accepted: false, reason: "speed_ceiling" });
        },
      ),
    );
  });
});
