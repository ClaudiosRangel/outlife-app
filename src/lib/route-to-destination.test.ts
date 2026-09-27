import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { buildDestinationDraft } from "@/lib/route-to-destination";

describe("buildDestinationDraft", () => {
  it("rejeita trajeto com < 2 pontos", () => {
    expect(() => buildDestinationDraft([])).toThrow();
    expect(() => buildDestinationDraft([{ lat: -20.7, lng: -41.0 }])).toThrow();
  });

  it("monta GeoJSON [lng,lat] na ordem e distância > 0", () => {
    const d = buildDestinationDraft([
      { lat: -20.70304, lng: -41.092004 },
      { lat: -20.70306, lng: -41.092024 },
      { lat: -20.703309, lng: -41.091616 },
    ]);
    expect(d.routeGeojson.type).toBe("LineString");
    expect(d.routeGeojson.coordinates[0]).toEqual([-41.092004, -20.70304]);
    expect(d.routeGeojson.coordinates).toHaveLength(3);
    expect(d.distanceKm).toBeGreaterThanOrEqual(0);
    expect(d.startLat).toBe(-20.70304);
    expect(d.startLng).toBe(-41.092004);
  });

  it("acumula ganho de elevação só nas subidas", () => {
    const d = buildDestinationDraft([
      { lat: 0, lng: 0, alt: 100 },
      { lat: 0, lng: 0.001, alt: 130 }, // +30
      { lat: 0, lng: 0.002, alt: 120 }, // desce (não conta)
      { lat: 0, lng: 0.003, alt: 140 }, // +20
    ]);
    expect(d.elevationGainM).toBe(50);
  });

  // Property: distanceKm >= 0 e geojson com N coords na ordem
  it("Property: distância >= 0 e coords preservadas", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            lat: fc.integer({ min: -89_000_000, max: 89_000_000 }).map((n) => n / 1e6),
            lng: fc.integer({ min: -179_000_000, max: 179_000_000 }).map((n) => n / 1e6),
          }),
          { minLength: 2, maxLength: 40 },
        ),
        (pts) => {
          const d = buildDestinationDraft(pts);
          return (
            d.distanceKm >= 0 &&
            Number.isFinite(d.distanceKm) &&
            d.routeGeojson.coordinates.length === pts.length &&
            d.routeGeojson.coordinates[0][0] === pts[0].lng
          );
        },
      ),
    );
  });
});
