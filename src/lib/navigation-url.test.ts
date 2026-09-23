import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { buildDirectionsUrl, isValidLatLng } from "./navigation-url";

describe("isValidLatLng", () => {
  it("aceita coordenadas válidas e rejeita inválidas", () => {
    expect(isValidLatLng({ lat: -22.9, lng: -43.2 })).toBe(true);
    expect(isValidLatLng({ lat: 0, lng: 0 })).toBe(true);
    expect(isValidLatLng(null)).toBe(false);
    expect(isValidLatLng({ lat: NaN, lng: 0 })).toBe(false);
    expect(isValidLatLng({ lat: 91, lng: 0 })).toBe(false);
    expect(isValidLatLng({ lat: 0, lng: 181 })).toBe(false);
    expect(isValidLatLng({ lat: 0, lng: Infinity })).toBe(false);
  });
});

describe("buildDirectionsUrl", () => {
  it("monta URL do Google Maps com destino e travelmode", () => {
    const url = buildDirectionsUrl({ lat: -22.9, lng: -43.2 }, { activityType: "pedalada" });
    expect(url).toContain("https://www.google.com/maps/dir/");
    expect(url).toContain("destination=-22.9%2C-43.2");
    expect(url).toContain("travelmode=bicycling");
  });

  it("inclui origem quando fornecida e válida", () => {
    const url = buildDirectionsUrl(
      { lat: 1, lng: 2 },
      { origin: { lat: 3, lng: 4 }, activityType: "trilha" },
    );
    expect(url).toContain("origin=3%2C4");
    expect(url).toContain("travelmode=walking");
  });

  it("ignora origem inválida sem quebrar", () => {
    const url = buildDirectionsUrl({ lat: 1, lng: 2 }, { origin: { lat: NaN, lng: 0 } });
    expect(url).not.toBeNull();
    expect(url).not.toContain("origin=");
  });

  it("retorna null para destino inválido", () => {
    expect(buildDirectionsUrl({ lat: NaN, lng: 0 })).toBeNull();
    expect(buildDirectionsUrl({ lat: 999, lng: 0 })).toBeNull();
  });

  it("propriedade: destino válido sempre gera URL https com destination", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -90, max: 90, noNaN: true }),
        fc.double({ min: -180, max: 180, noNaN: true }),
        (lat, lng) => {
          const url = buildDirectionsUrl({ lat, lng });
          expect(url).not.toBeNull();
          expect(url!.startsWith("https://")).toBe(true);
          expect(url).toContain("destination=");
        },
      ),
    );
  });
});
