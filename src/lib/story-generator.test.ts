import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { routeTotalKm } from "./story-generator";

describe("routeTotalKm", () => {
  it("0 para trajeto vazio ou de 1 ponto", () => {
    expect(routeTotalKm([])).toBe(0);
    expect(routeTotalKm([{ lat: -22, lng: -43 }])).toBe(0);
  });

  it("distância positiva e crescente com mais pontos afastados", () => {
    const a = [
      { lat: -22.0, lng: -43.0 },
      { lat: -22.01, lng: -43.0 },
    ];
    const b = [
      { lat: -22.0, lng: -43.0 },
      { lat: -22.01, lng: -43.0 },
      { lat: -22.02, lng: -43.0 },
    ];
    expect(routeTotalKm(a)).toBeGreaterThan(0);
    expect(routeTotalKm(b)).toBeGreaterThan(routeTotalKm(a));
  });

  it("nunca negativo, finito, para qualquer sequência de coordenadas válidas", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            lat: fc.double({ min: -60, max: 60, noNaN: true }),
            lng: fc.double({ min: -180, max: 180, noNaN: true }),
          }),
          { maxLength: 50 },
        ),
        (path) => {
          const d = routeTotalKm(path);
          expect(d).toBeGreaterThanOrEqual(0);
          expect(Number.isFinite(d)).toBe(true);
        },
      ),
    );
  });
});
