import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { outdoorVerdict, weatherCodeKey } from "./weather";

describe("weather.outdoorVerdict", () => {
  it("avoid em tempestade, vento extremo ou alta chance de chuva", () => {
    expect(outdoorVerdict({ windKmh: 10, precipProbabilityMax: 10, apparentC: 22, weatherCode: 95 })).toBe("avoid");
    expect(outdoorVerdict({ windKmh: 55, precipProbabilityMax: 10, apparentC: 22, weatherCode: 0 })).toBe("avoid");
    expect(outdoorVerdict({ windKmh: 10, precipProbabilityMax: 85, apparentC: 22, weatherCode: 0 })).toBe("avoid");
  });

  it("caution em chuva moderada, vento forte, calor/frio extremo", () => {
    expect(outdoorVerdict({ windKmh: 35, precipProbabilityMax: 10, apparentC: 22, weatherCode: 0 })).toBe("caution");
    expect(outdoorVerdict({ windKmh: 10, precipProbabilityMax: 60, apparentC: 22, weatherCode: 0 })).toBe("caution");
    expect(outdoorVerdict({ windKmh: 10, precipProbabilityMax: 10, apparentC: 40, weatherCode: 0 })).toBe("caution");
    expect(outdoorVerdict({ windKmh: 10, precipProbabilityMax: 10, apparentC: 1, weatherCode: 0 })).toBe("caution");
  });

  it("good em tempo bom", () => {
    expect(outdoorVerdict({ windKmh: 8, precipProbabilityMax: 5, apparentC: 24, weatherCode: 0 })).toBe("good");
  });

  it("nunca lança e sempre retorna um dos 3 valores", () => {
    fc.assert(
      fc.property(
        fc.record({
          windKmh: fc.double({ min: 0, max: 200, noNaN: true }),
          precipProbabilityMax: fc.option(fc.integer({ min: 0, max: 100 }), { nil: null }),
          apparentC: fc.double({ min: -30, max: 55, noNaN: true }),
          weatherCode: fc.integer({ min: 0, max: 99 }),
        }),
        (w) => {
          expect(["good", "caution", "avoid"]).toContain(outdoorVerdict(w));
        },
      ),
    );
  });

  it("weatherCodeKey mapeia faixas conhecidas", () => {
    expect(weatherCodeKey(0)).toBe("clear");
    expect(weatherCodeKey(2)).toBe("cloudy");
    expect(weatherCodeKey(61)).toBe("rain");
    expect(weatherCodeKey(75)).toBe("snow");
    expect(weatherCodeKey(97)).toBe("storm");
  });
});
