import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { parseGpx } from "@/lib/gpx-import";

// Fixture reduzida do GPX real da Cachoeira Alta (primeiros pontos + metadata).
const GPX_CACHOEIRA = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Trivlock" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Cachoeira Alta</name>
    <desc>A Cachoeira Alta é uma das quedas d'água mais impressionantes da região.</desc>
  </metadata>
  <trk>
    <name>Cachoeira Alta</name>
    <trkseg>
      <trkpt lat="-20.70304" lon="-41.092004"/>
      <trkpt lat="-20.70306" lon="-41.092024"/>
      <trkpt lat="-20.703309" lon="-41.091616"/>
      <trkpt lat="-20.70336" lon="-41.091498"/>
    </trkseg>
  </trk>
</gpx>`;

describe("parseGpx — GPX real (Cachoeira Alta)", () => {
  const r = parseGpx(GPX_CACHOEIRA);

  it("extrai nome e descrição da metadata", () => {
    expect(r.name).toBe("Cachoeira Alta");
    expect(r.description).toContain("quedas d'água");
  });

  it("preserva a ordem e a quantidade de pontos", () => {
    expect(r.points).toHaveLength(4);
    expect(r.points[0]).toMatchObject({ lat: -20.70304, lng: -41.092004 });
  });

  it("distância > 0 e GeoJSON LineString [lng,lat]", () => {
    expect(r.distanceMeters).toBeGreaterThan(0);
    expect(r.geojson?.type).toBe("LineString");
    expect(r.geojson?.coordinates[0]).toEqual([-41.092004, -20.70304]);
  });

  it("start e bounds corretos; sem elevação neste arquivo", () => {
    expect(r.start).toEqual({ lat: -20.70304, lng: -41.092004 });
    expect(r.bounds?.minLat).toBeLessThanOrEqual(r.bounds!.maxLat);
    expect(r.hasElevation).toBe(false);
  });
});

describe("parseGpx — validação", () => {
  it("rejeita GPX vazio", () => {
    expect(() => parseGpx("")).toThrow();
  });

  it("rejeita GPX com menos de 2 pontos", () => {
    const one = `<gpx><trk><trkseg><trkpt lat="-20.7" lon="-41.0"/></trkseg></trk></gpx>`;
    expect(() => parseGpx(one)).toThrow();
  });

  it("ignora coordenadas fora do intervalo válido", () => {
    const bad = `<gpx><trkseg>
      <trkpt lat="-20.7" lon="-41.0"/>
      <trkpt lat="999" lon="-41.0"/>
      <trkpt lat="-20.8" lon="-41.1"/>
    </trkseg></gpx>`;
    const r = parseGpx(bad);
    expect(r.points).toHaveLength(2); // o lat=999 é descartado
  });

  it("lê elevação quando presente", () => {
    const withEle = `<gpx><trkseg>
      <trkpt lat="-20.7" lon="-41.0"><ele>100</ele></trkpt>
      <trkpt lat="-20.8" lon="-41.1"><ele>150</ele></trkpt>
    </trkseg></gpx>`;
    const r = parseGpx(withEle);
    expect(r.hasElevation).toBe(true);
    expect(r.points[1].ele).toBe(150);
  });

  // Property 1: distância >= 0 e nº de pontos preservado
  // Property 2: geojson LineString com >=2 coords [lng,lat]
  it("Properties 1 e 2: distância >= 0 e GeoJSON válido", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            // Coordenadas realistas (6 casas decimais), evitando denormais que
            // serializariam em notação científica extrema.
            lat: fc.integer({ min: -89_000_000, max: 89_000_000 }).map((n) => n / 1e6),
            lng: fc.integer({ min: -179_000_000, max: 179_000_000 }).map((n) => n / 1e6),
          }),
          { minLength: 2, maxLength: 50 },
        ),
        (pts) => {
          const xml =
            "<gpx><trkseg>" +
            pts.map((p) => `<trkpt lat="${p.lat}" lon="${p.lng}"/>`).join("") +
            "</trkseg></gpx>";
          const r = parseGpx(xml);
          const okDist = r.distanceMeters >= 0 && Number.isFinite(r.distanceMeters);
          const okGeo =
            r.geojson != null &&
            r.geojson.type === "LineString" &&
            r.geojson.coordinates.length === r.points.length &&
            r.geojson.coordinates.length >= 2;
          const okOrder = r.geojson!.coordinates[0][0] === r.points[0].lng;
          return okDist && okGeo && okOrder;
        },
      ),
    );
  });
});
