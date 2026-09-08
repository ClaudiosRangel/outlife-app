import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  classifyLevel,
  levelProgress,
  sanitizeLevelStats,
  LEVEL_THRESHOLDS,
  type LevelStats,
  type UserLevel,
} from "./user-level";

const LEVEL_ORDER: Record<UserLevel, number> = { iniciante: 0, intermediario: 1, avancado: 2 };

describe("classifyLevel — casos base", () => {
  it("sem atividade → iniciante (piso)", () => {
    expect(classifyLevel({ completedActivities: 0, totalKm: 0, totalElevationGain: 0 })).toBe("iniciante");
    expect(classifyLevel(null)).toBe("iniciante");
    expect(classifyLevel(undefined)).toBe("iniciante");
  });

  it("atinge intermediário por qualquer eixo (OR)", () => {
    expect(classifyLevel({ completedActivities: 10, totalKm: 0, totalElevationGain: 0 })).toBe("intermediario");
    expect(classifyLevel({ completedActivities: 0, totalKm: 50, totalElevationGain: 0 })).toBe("intermediario");
    expect(classifyLevel({ completedActivities: 0, totalKm: 0, totalElevationGain: 1000 })).toBe("intermediario");
  });

  it("atinge avançado por qualquer eixo (OR)", () => {
    expect(classifyLevel({ completedActivities: 50, totalKm: 0, totalElevationGain: 0 })).toBe("avancado");
    expect(classifyLevel({ completedActivities: 0, totalKm: 300, totalElevationGain: 0 })).toBe("avancado");
    expect(classifyLevel({ completedActivities: 0, totalKm: 0, totalElevationGain: 8000 })).toBe("avancado");
  });

  it("logo abaixo do limiar não promove", () => {
    expect(classifyLevel({ completedActivities: 9, totalKm: 49.9, totalElevationGain: 999 })).toBe("iniciante");
    expect(classifyLevel({ completedActivities: 49, totalKm: 299, totalElevationGain: 7999 })).toBe("intermediario");
  });
});

describe("sanitizeLevelStats — Req 7.1", () => {
  it("nulos/NaN/negativos viram 0", () => {
    const r = sanitizeLevelStats({ completedActivities: -5, totalKm: Number.NaN, totalElevationGain: Number.POSITIVE_INFINITY });
    expect(r).toEqual({ completedActivities: 0, totalKm: 0, totalElevationGain: 0 });
  });
});

describe("levelProgress", () => {
  it("nível máximo → 100", () => {
    expect(levelProgress({ completedActivities: 60, totalKm: 400, totalElevationGain: 9000 })).toBe(100);
  });
  it("metade do caminho de iniciante p/ intermediário (por km)", () => {
    // 25 km de 50 → ~50%
    expect(levelProgress({ completedActivities: 0, totalKm: 25, totalElevationGain: 0 })).toBe(50);
  });
});

describe("Property 1: total e determinístico (nunca lança, sempre um dos 3)", () => {
  it("classifyLevel", () => {
    fc.assert(
      fc.property(
        fc.record({
          completedActivities: fc.oneof(fc.integer(), fc.double(), fc.constant(Number.NaN)),
          totalKm: fc.oneof(fc.integer(), fc.double(), fc.constant(Number.NaN)),
          totalElevationGain: fc.oneof(fc.integer(), fc.double(), fc.constant(Number.NaN)),
        }),
        (stats) => {
          const level = classifyLevel(stats as LevelStats);
          expect(["iniciante", "intermediario", "avancado"]).toContain(level);
        },
      ),
    );
  });
});

describe("Property 2: monotônico (aumentar qualquer eixo nunca rebaixa)", () => {
  it("classifyLevel", () => {
    fc.assert(
      fc.property(
        fc.record({
          completedActivities: fc.nat({ max: 200 }),
          totalKm: fc.double({ min: 0, max: 1000, noNaN: true }),
          totalElevationGain: fc.double({ min: 0, max: 20000, noNaN: true }),
        }),
        fc.record({
          a: fc.nat({ max: 100 }),
          k: fc.double({ min: 0, max: 500, noNaN: true }),
          e: fc.double({ min: 0, max: 10000, noNaN: true }),
        }),
        (base, inc) => {
          const before = classifyLevel(base as LevelStats);
          const after = classifyLevel({
            completedActivities: base.completedActivities + inc.a,
            totalKm: base.totalKm + inc.k,
            totalElevationGain: base.totalElevationGain + inc.e,
          });
          expect(LEVEL_ORDER[after]).toBeGreaterThanOrEqual(LEVEL_ORDER[before]);
        },
      ),
    );
  });
});

describe("Property 3: progresso em [0,100], 100 no máximo", () => {
  it("levelProgress", () => {
    fc.assert(
      fc.property(
        fc.record({
          completedActivities: fc.nat({ max: 200 }),
          totalKm: fc.double({ min: 0, max: 1000, noNaN: true }),
          totalElevationGain: fc.double({ min: 0, max: 20000, noNaN: true }),
        }),
        (stats) => {
          const p = levelProgress(stats as LevelStats);
          expect(Number.isFinite(p)).toBe(true);
          expect(p).toBeGreaterThanOrEqual(0);
          expect(p).toBeLessThanOrEqual(100);
          if (classifyLevel(stats as LevelStats) === "avancado") {
            expect(p).toBe(100);
          }
        },
      ),
    );
  });
});

// Guarda: garante que os limiares seguem crescentes (avançado > intermediário).
describe("LEVEL_THRESHOLDS coerentes", () => {
  it("avançado exige mais que intermediário", () => {
    expect(LEVEL_THRESHOLDS.avancado.activities).toBeGreaterThan(LEVEL_THRESHOLDS.intermediario.activities);
    expect(LEVEL_THRESHOLDS.avancado.km).toBeGreaterThan(LEVEL_THRESHOLDS.intermediario.km);
    expect(LEVEL_THRESHOLDS.avancado.elevation).toBeGreaterThan(LEVEL_THRESHOLDS.intermediario.elevation);
  });
});
