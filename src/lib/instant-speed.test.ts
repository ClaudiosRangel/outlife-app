import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  SPEED_STALE_MS,
  computeSmoothedSpeed,
  pushWindow,
  mpsToKmh,
  type SpeedWindowPoint,
} from "@/lib/instant-speed";

const BASE = { lat: -22.9, lng: -43.2 };
function north(meters: number, ts: number): SpeedWindowPoint {
  return { lat: BASE.lat + meters / 111_320, lng: BASE.lng, ts };
}

describe("computeSmoothedSpeed (Req 4)", () => {
  it("retorna null com menos de 2 pontos (Req 4.3)", () => {
    expect(computeSmoothedSpeed([], 10_000)).toBeNull();
    expect(computeSmoothedSpeed([north(0, 10_000)], 10_000)).toBeNull();
  });

  it("retorna null quando o último ponto é mais velho que SPEED_STALE_MS (Req 4.7)", () => {
    const w = [north(0, 0), north(2, 2000)];
    expect(computeSmoothedSpeed(w, 2000 + SPEED_STALE_MS + 1)).toBeNull();
  });

  it("calcula ~1 m/s para 2m em 2s", () => {
    const w = [north(0, 0), north(2, 2000)];
    const v = computeSmoothedSpeed(w, 2000);
    expect(v).not.toBeNull();
    expect(v!).toBeCloseTo(1, 1);
  });

  it("ignora pares com dt <= 0 sem dividir por zero", () => {
    const w = [north(0, 0), north(2, 0), north(4, 4000)]; // segundo par tem dt 0? (0→0)
    const v = computeSmoothedSpeed(w, 4000);
    expect(v).not.toBeNull();
    expect(Number.isFinite(v!)).toBe(true);
  });

  it("retorna null quando todos os pares têm dt <= 0", () => {
    const w = [north(0, 5000), north(2, 5000)];
    expect(computeSmoothedSpeed(w, 5000)).toBeNull();
  });

  it("Property 6: nunca retorna NaN/Infinity — só null ou finito >= 0", () => {
    const pt = () =>
      fc.record({
        lat: fc.double({ min: -60, max: 60, noNaN: true }),
        lng: fc.double({ min: -180, max: 180, noNaN: true }),
        ts: fc.integer({ min: 0, max: 1_000_000 }),
      });
    fc.assert(
      fc.property(fc.array(pt(), { maxLength: 8 }), fc.integer({ min: 0, max: 1_100_000 }), (w, now) => {
        const v = computeSmoothedSpeed(w as SpeedWindowPoint[], now);
        if (v !== null) {
          expect(Number.isFinite(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
        }
      }),
    );
  });
});

describe("pushWindow", () => {
  it("mantém no máximo maxSize elementos, descartando os mais antigos", () => {
    let w: SpeedWindowPoint[] = [];
    for (let i = 0; i < 10; i++) w = pushWindow(w, north(i, i * 1000), 5);
    expect(w).toHaveLength(5);
    expect(w[0].ts).toBe(5000);
    expect(w[4].ts).toBe(9000);
  });

  it("não muta a janela original", () => {
    const w: SpeedWindowPoint[] = [north(0, 0)];
    const next = pushWindow(w, north(2, 2000), 5);
    expect(w).toHaveLength(1);
    expect(next).toHaveLength(2);
  });
});

describe("mpsToKmh", () => {
  it("converte corretamente", () => {
    expect(mpsToKmh(1)).toBeCloseTo(3.6, 5);
    expect(mpsToKmh(0)).toBe(0);
  });
});
