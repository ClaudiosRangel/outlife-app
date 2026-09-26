import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { deriveWeatherAlerts, hasWeatherAlert } from "@/lib/weather-alerts";

describe("deriveWeatherAlerts", () => {
  it("céu limpo sem vento/UV/chuva → sem alertas", () => {
    expect(deriveWeatherAlerts({ code: 0, windKmh: 5, uvMax: 3, precipitation: 0 })).toEqual([]);
    expect(hasWeatherAlert({ code: 0, windKmh: 5, uvMax: 3, precipitation: 0 })).toBe(false);
  });

  it("tempestade (código 95) → danger storm", () => {
    const a = deriveWeatherAlerts({ code: 95, windKmh: 10, uvMax: 2, precipitation: 0 });
    expect(a.some((x) => x.code === "storm" && x.level === "danger")).toBe(true);
  });

  it("chuva forte agora → warning heavy_rain", () => {
    const a = deriveWeatherAlerts({ code: 61, windKmh: 5, uvMax: 1, precipitation: 3 });
    expect(a.some((x) => x.code === "heavy_rain")).toBe(true);
  });

  it("alta prob. de chuva adiante (sem chuva agora) → rain_likely", () => {
    const a = deriveWeatherAlerts({ code: 2, windKmh: 5, uvMax: 1, precipitation: 0, maxPrecipProbNextHours: 80 });
    expect(a.some((x) => x.code === "rain_likely")).toBe(true);
  });

  it("UV alto e vento forte → dois warnings", () => {
    const a = deriveWeatherAlerts({ code: 0, windKmh: 40, uvMax: 9, precipitation: 0 });
    expect(a.some((x) => x.code === "high_uv")).toBe(true);
    expect(a.some((x) => x.code === "strong_wind")).toBe(true);
  });

  // Property 4: determinístico e só sinaliza acima dos limiares
  it("Property 4: determinístico", () => {
    fc.assert(
      fc.property(
        fc.record({
          code: fc.integer({ min: 0, max: 99 }),
          windKmh: fc.double({ min: 0, max: 120, noNaN: true }),
          uvMax: fc.option(fc.double({ min: 0, max: 12, noNaN: true }), { nil: null }),
          precipitation: fc.double({ min: 0, max: 50, noNaN: true }),
        }),
        (w) => {
          const a1 = JSON.stringify(deriveWeatherAlerts(w));
          const a2 = JSON.stringify(deriveWeatherAlerts(w));
          return a1 === a2;
        },
      ),
    );
  });

  // Property 4b: abaixo de todos os limiares nunca gera alerta
  it("Property 4b: abaixo dos limiares → vazio", () => {
    fc.assert(
      fc.property(
        fc.record({
          code: fc.integer({ min: 0, max: 80 }), // < 95 (sem tempestade)
          windKmh: fc.double({ min: 0, max: 34.9, noNaN: true }),
          uvMax: fc.double({ min: 0, max: 7.9, noNaN: true }),
          precipitation: fc.double({ min: 0, max: 1.9, noNaN: true }),
        }),
        (w) => deriveWeatherAlerts({ ...w, maxPrecipProbNextHours: 0 }).length === 0,
      ),
    );
  });
});
