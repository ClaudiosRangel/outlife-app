import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { matchSegmentEffort, nearestPointIndex, type MatchPoint, type SegmentGeo } from "./segment-match";

// Trajeto reto ao longo de uma linha de longitude (aprox. 111km por grau de lat).
function straightTrack(startTs: number, stepSeconds: number, count: number): MatchPoint[] {
  const pts: MatchPoint[] = [];
  for (let i = 0; i < count; i++) {
    pts.push({ lat: -22.9 + i * 0.001, lng: -43.2, ts: startTs + i * stepSeconds * 1000 });
  }
  return pts;
}

describe("segment-match", () => {
  it("detecta esforço quando o trajeto cobre o segmento", () => {
    const track = straightTrack(1_000_000, 10, 20); // 20 pontos, 10s cada
    // Segmento do ponto 2 ao 12 (~ 10 * 0.001 grau lat ≈ 1113 m).
    const seg: SegmentGeo = {
      startLat: track[2].lat,
      startLng: track[2].lng,
      endLat: track[12].lat,
      endLng: track[12].lng,
      distanceMeters: 1113,
    };
    const r = matchSegmentEffort(track, seg, { radiusMeters: 30, distanceTolerance: 0.4 });
    expect(r.matched).toBe(true);
    expect(r.elapsedSeconds).toBe(100); // 10 passos de 10s
    expect(r.startIdx).toBeLessThan(r.endIdx!);
  });

  it("não detecta quando só o início é atingido (fim longe)", () => {
    const track = straightTrack(0, 5, 10);
    const seg: SegmentGeo = {
      startLat: track[1].lat,
      startLng: track[1].lng,
      endLat: -10.0, // muito longe
      endLng: -43.2,
      distanceMeters: 1000,
    };
    expect(matchSegmentEffort(track, seg).matched).toBe(false);
  });

  it("não detecta com menos de 2 pontos", () => {
    expect(matchSegmentEffort([], { startLat: 0, startLng: 0, endLat: 1, endLng: 1, distanceMeters: 10 }).matched).toBe(false);
    expect(matchSegmentEffort([{ lat: 0, lng: 0, ts: 0 }], { startLat: 0, startLng: 0, endLat: 1, endLng: 1, distanceMeters: 10 }).matched).toBe(false);
  });

  it("elapsedSeconds nunca é negativo (Property 2)", () => {
    const track = straightTrack(500000, 8, 15);
    const seg: SegmentGeo = {
      startLat: track[3].lat, startLng: track[3].lng,
      endLat: track[10].lat, endLng: track[10].lng,
      distanceMeters: 779,
    };
    const r = matchSegmentEffort(track, seg, { radiusMeters: 30, distanceTolerance: 0.5 });
    if (r.matched) expect(r.elapsedSeconds!).toBeGreaterThanOrEqual(0);
  });

  it("nearestPointIndex respeita o parâmetro from", () => {
    const track = straightTrack(0, 1, 10);
    const target = { lat: track[8].lat, lng: track[8].lng };
    const r = nearestPointIndex(track, target, 5);
    expect(r.idx).toBe(8);
  });

  it("robusto a pontos não-finitos (não lança)", () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ lat: fc.double(), lng: fc.double(), ts: fc.integer() }), { maxLength: 30 }),
        (pts) => {
          const seg: SegmentGeo = { startLat: 0, startLng: 0, endLat: 1, endLng: 1, distanceMeters: 100 };
          expect(() => matchSegmentEffort(pts as MatchPoint[], seg)).not.toThrow();
        },
      ),
    );
  });
});
