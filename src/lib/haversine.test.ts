import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { haversineMeters, isWithinRadius } from "./haversine";

// Property 7 (Frente G, parte GPS): isWithinRadius coerente e nunca NaN/erro.
describe("isWithinRadius (Property 7)", () => {
  it("ponto no centro está sempre dentro (raio >= 0)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -89, max: 89, noNaN: true }),
        fc.double({ min: -179, max: 179, noNaN: true }),
        fc.double({ min: 0, max: 100000, noNaN: true }),
        (lat, lng, r) => {
          expect(isWithinRadius({ lat, lng }, { lat, lng }, r)).toBe(true);
        },
      ),
    );
  });

  it("coerente com haversineMeters (dentro sse distância <= raio)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -80, max: 80, noNaN: true }),
        fc.double({ min: -170, max: 170, noNaN: true }),
        fc.double({ min: -80, max: 80, noNaN: true }),
        fc.double({ min: -170, max: 170, noNaN: true }),
        fc.double({ min: 0, max: 5000000, noNaN: true }),
        (aLat, aLng, bLat, bLng, r) => {
          const a = { lat: aLat, lng: aLng };
          const b = { lat: bLat, lng: bLng };
          const d = haversineMeters(a, b);
          expect(isWithinRadius(a, b, r)).toBe(d <= r);
        },
      ),
    );
  });

  it("entradas inválidas retornam false (nunca lança/NaN)", () => {
    expect(isWithinRadius({ lat: NaN, lng: 0 }, { lat: 0, lng: 0 }, 100)).toBe(false);
    expect(isWithinRadius({ lat: 0, lng: 0 }, { lat: 0, lng: Infinity }, 100)).toBe(false);
    expect(isWithinRadius({ lat: 0, lng: 0 }, { lat: 0, lng: 0 }, -1)).toBe(false);
    expect(isWithinRadius({ lat: 0, lng: 0 }, { lat: 0, lng: 0 }, NaN)).toBe(false);
  });
});
