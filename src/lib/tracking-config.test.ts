import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { ActivityType } from "@/lib/activity-metrics";
import {
  ACCURACY_MIN,
  ACCURACY_MAX,
  DEFAULT_PROFILE,
  TRACKING_PROFILES,
  getProfile,
  isValidAccuracyThreshold,
} from "@/lib/tracking-config";

const ALL_TYPES: readonly ActivityType[] = ["caminhada", "pedalada", "trilha", "outro"];

describe("tracking-config — invariantes dos perfis", () => {
  it("caminhada tem Speed_Ceiling estritamente menor que pedalada (Req 2.5)", () => {
    expect(TRACKING_PROFILES.caminhada.maxSpeedMps).toBeLessThan(
      TRACKING_PROFILES.pedalada.maxSpeedMps,
    );
  });

  it("caminhada tem deslocamento mínimo estritamente menor que 2m (Req 3.5)", () => {
    expect(TRACKING_PROFILES.caminhada.minDistanceMeters).toBeLessThan(2);
  });

  it("todo maxAccuracyMeters default é < 20 e dentro de [ACCURACY_MIN, ACCURACY_MAX] (Req 1.4)", () => {
    for (const type of ALL_TYPES) {
      const { maxAccuracyMeters } = TRACKING_PROFILES[type];
      expect(maxAccuracyMeters).toBeLessThan(20);
      expect(maxAccuracyMeters).toBeGreaterThanOrEqual(ACCURACY_MIN);
      expect(maxAccuracyMeters).toBeLessThanOrEqual(ACCURACY_MAX);
    }
  });

  it("todos os perfis têm limiares finitos e positivos", () => {
    for (const type of ALL_TYPES) {
      const p = TRACKING_PROFILES[type];
      expect(Number.isFinite(p.maxAccuracyMeters) && p.maxAccuracyMeters > 0).toBe(true);
      expect(Number.isFinite(p.minDistanceMeters) && p.minDistanceMeters > 0).toBe(true);
      expect(Number.isFinite(p.maxSpeedMps) && p.maxSpeedMps > 0).toBe(true);
    }
  });
});

describe("getProfile — fallback (Req 3.4)", () => {
  it("retorna o perfil correto para cada Activity_Type conhecido", () => {
    for (const type of ALL_TYPES) {
      expect(getProfile(type)).toBe(TRACKING_PROFILES[type]);
    }
  });

  it("retorna DEFAULT_PROFILE para null/undefined", () => {
    expect(getProfile(null)).toBe(DEFAULT_PROFILE);
    expect(getProfile(undefined)).toBe(DEFAULT_PROFILE);
  });

  it("retorna DEFAULT_PROFILE para tipo desconhecido", () => {
    // força um valor fora do union para simular dado corrompido/legado
    expect(getProfile("corrida" as unknown as ActivityType)).toBe(DEFAULT_PROFILE);
    expect(getProfile("" as unknown as ActivityType)).toBe(DEFAULT_PROFILE);
  });

  it("property: getProfile nunca lança e sempre retorna um perfil válido", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const p = getProfile(s as unknown as ActivityType);
        expect(p).toBeDefined();
        expect(typeof p.maxAccuracyMeters).toBe("number");
        expect(typeof p.minDistanceMeters).toBe("number");
        expect(typeof p.maxSpeedMps).toBe("number");
      }),
    );
  });
});

describe("isValidAccuracyThreshold (Req 1.4)", () => {
  it("aceita valores dentro da faixa e rejeita fora", () => {
    expect(isValidAccuracyThreshold(ACCURACY_MIN)).toBe(true);
    expect(isValidAccuracyThreshold(ACCURACY_MAX)).toBe(true);
    expect(isValidAccuracyThreshold(12)).toBe(true);
    expect(isValidAccuracyThreshold(ACCURACY_MIN - 1)).toBe(false);
    expect(isValidAccuracyThreshold(ACCURACY_MAX + 1)).toBe(false);
  });

  it("rejeita valores não-finitos", () => {
    expect(isValidAccuracyThreshold(NaN)).toBe(false);
    expect(isValidAccuracyThreshold(Infinity)).toBe(false);
    expect(isValidAccuracyThreshold(-Infinity)).toBe(false);
  });

  it("property: só retorna true dentro da faixa fechada [MIN, MAX]", () => {
    fc.assert(
      fc.property(fc.double({ noNaN: false }), (v) => {
        const expected = Number.isFinite(v) && v >= ACCURACY_MIN && v <= ACCURACY_MAX;
        expect(isValidAccuracyThreshold(v)).toBe(expected);
      }),
    );
  });
});
