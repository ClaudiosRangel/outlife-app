import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { filterNearby, type NowMarker } from "./nearby";

const rio = { lat: -22.9, lng: -43.2 };

function mk(id: string, kind: NowMarker["kind"], lat: number, lng: number): NowMarker {
  return { id, kind, lat, lng, title: id };
}

describe("nearby", () => {
  it("filtra por raio e ordena por distância (amigos primeiro)", () => {
    const markers: NowMarker[] = [
      mk("perto-parceiro", "partner", -22.91, -43.21),
      mk("perto-amigo", "friend", -22.92, -43.22),
      mk("longe", "partner", 0, 0), // fora do raio
    ];
    const out = filterNearby(markers, rio, { radiusMeters: 50_000, limit: 10 });
    expect(out.map((m) => m.id)).toEqual(["perto-amigo", "perto-parceiro"]);
  });

  it("respeita o limite", () => {
    const markers = Array.from({ length: 100 }, (_, i) =>
      mk(`p${i}`, "partner", -22.9 + i * 0.0001, -43.2),
    );
    const out = filterNearby(markers, rio, { limit: 5 });
    expect(out.length).toBe(5);
  });

  it("sem centro retorna priorizando amigos e limitado", () => {
    const markers: NowMarker[] = [
      mk("a", "partner", -22.9, -43.2),
      mk("b", "friend", -23.0, -43.3),
    ];
    const out = filterNearby(markers, null, { limit: 10 });
    expect(out[0].kind).toBe("friend");
  });

  it("ignora coordenadas não-finitas sem lançar (Property 3)", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string(),
            kind: fc.constantFrom<NowMarker["kind"]>("friend", "partner", "event"),
            lat: fc.double(),
            lng: fc.double(),
            title: fc.string(),
          }),
          { maxLength: 50 },
        ),
        fc.integer({ min: 0, max: 20 }),
        (markers, limit) => {
          const out = filterNearby(markers as NowMarker[], rio, { limit });
          expect(out.length).toBeLessThanOrEqual(limit);
        },
      ),
    );
  });
});
