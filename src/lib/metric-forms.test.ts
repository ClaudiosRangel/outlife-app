import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { computeByMetricForm, type MetricForm } from "./metric-forms";

const FORMS: MetricForm[] = ["pace_km", "speed_elevation", "pace_100m"];

describe("computeByMetricForm (Property 4 — Frente D)", () => {
  it("nunca retorna NaN/Infinity em nenhum campo", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...FORMS),
        fc.double({ min: 0, max: 200000, noNaN: true }),
        fc.integer({ min: 0, max: 100000 }),
        fc.double({ min: -100, max: 5000, noNaN: true }),
        (form, dist, dur, elev) => {
          const out = computeByMetricForm(form, { distanceMeters: dist, durationSeconds: dur, elevationGain: elev });
          for (const line of [out.primary, out.secondary]) {
            if (line) {
              expect(line.value.includes("NaN")).toBe(false);
              expect(line.value.includes("Infinity")).toBe(false);
            }
          }
          if (out.speedKmh) {
            expect(Number.isFinite(Number(out.speedKmh))).toBe(true);
          }
        },
      ),
    );
  });

  it("duração 0 → primary e speedKmh nulos", () => {
    for (const form of FORMS) {
      const out = computeByMetricForm(form, { distanceMeters: 1000, durationSeconds: 0 });
      expect(out.primary).toBeNull();
      expect(out.speedKmh).toBeNull();
    }
  });

  it("pace_100m: 100 m em 120 s = 2:00/100m", () => {
    const out = computeByMetricForm("pace_100m", { distanceMeters: 100, durationSeconds: 120 });
    expect(out.primary?.value).toBe("2:00/100m");
  });

  it("pace_km: 1000 m em 300 s = 5:00/km", () => {
    const out = computeByMetricForm("pace_km", { distanceMeters: 1000, durationSeconds: 300 });
    expect(out.primary?.value).toBe("5:00/km");
  });

  it("speed_elevation sempre traz secondary de elevação (0 m quando ausente)", () => {
    const semElev = computeByMetricForm("speed_elevation", { distanceMeters: 26770, durationSeconds: 5580 });
    expect(semElev.secondary?.value).toBe("0 m");
    const comElev = computeByMetricForm("speed_elevation", { distanceMeters: 26770, durationSeconds: 5580, elevationGain: 479 });
    expect(comElev.secondary?.value).toBe("479 m");
    expect(comElev.primary?.value).toContain("km/h");
  });
});
