import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  toActivityType,
  buildAdventureDraft,
  ADVENTURE_CATEGORIES,
  TRAVEL_MODES,
} from "@/lib/adventure-route";

describe("adventure-route", () => {
  it("Property 2: deslocamento mapeia para activity_type de rastreamento válido", () => {
    // bike → pedalada; foot → trilha. São activity_types REAIS do rastreador
    // (definem métricas/KOM), não categorias-lugar como cachoeira/pico/parque.
    // Obs.: "trilha" é, por coincidência de nome, também uma categoria de
    // aventura — mas aqui é o activity_type técnico (campo diferente de
    // `category`), então a validação é sobre o conjunto de tipos válidos.
    const VALID_ACTIVITY_TYPES = ["pedalada", "trilha"];
    expect(toActivityType("bike")).toBe("pedalada");
    expect(toActivityType("foot")).toBe("trilha");
    for (const m of TRAVEL_MODES) {
      expect(VALID_ACTIVITY_TYPES).toContain(toActivityType(m));
    }
    // nunca um lugar-categoria SEM sobreposição legítima (cachoeira/pico/…)
    const PLACE_ONLY = ADVENTURE_CATEGORIES.filter((c) => c !== "trilha");
    for (const m of TRAVEL_MODES) {
      expect(PLACE_ONLY).not.toContain(toActivityType(m) as never);
    }
  });

  it("categorias e modos são listas não vazias e distintas", () => {
    expect(ADVENTURE_CATEGORIES.length).toBeGreaterThan(0);
    expect(new Set(ADVENTURE_CATEGORIES).size).toBe(ADVENTURE_CATEGORIES.length);
    expect(TRAVEL_MODES).toEqual(["foot", "bike"]);
  });

  it("Property 1: buildAdventureDraft rejeita trajeto < 2 pontos", () => {
    expect(() => buildAdventureDraft([])).toThrow();
    expect(() => buildAdventureDraft([{ lat: -20.7, lng: -41.0 }])).toThrow();
  });

  it("buildAdventureDraft monta geojson [lng,lat] e distância >= 0", () => {
    const d = buildAdventureDraft([
      { lat: -20.70304, lng: -41.092004 },
      { lat: -20.703309, lng: -41.091616 },
    ]);
    expect(d.routeGeojson.type).toBe("LineString");
    expect(d.routeGeojson.coordinates[0]).toEqual([-41.092004, -20.70304]);
    expect(d.distanceKm).toBeGreaterThanOrEqual(0);
  });

  it("Property: draft preserva nº de coords e ordem", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            lat: fc.integer({ min: -89_000_000, max: 89_000_000 }).map((n) => n / 1e6),
            lng: fc.integer({ min: -179_000_000, max: 179_000_000 }).map((n) => n / 1e6),
          }),
          { minLength: 2, maxLength: 30 },
        ),
        (pts) => {
          const d = buildAdventureDraft(pts);
          return (
            d.routeGeojson.coordinates.length === pts.length &&
            d.routeGeojson.coordinates[0][0] === pts[0].lng &&
            d.distanceKm >= 0
          );
        },
      ),
    );
  });
});
