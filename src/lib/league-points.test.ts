import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { leaguePoints, sumLeaguePoints, type LeagueActivity } from "@/lib/league-points";

describe("leaguePoints", () => {
  it("1 ponto por 100m + 1 ponto por metro de elevação", () => {
    expect(leaguePoints(1000, 0)).toBe(10); // 1000/100 = 10
    expect(leaguePoints(0, 50)).toBe(50);
    expect(leaguePoints(1000, 50)).toBe(60);
  });

  it("trata null/NaN/negativo como 0", () => {
    expect(leaguePoints(null, null)).toBe(0);
    expect(leaguePoints(Number.NaN, Number.POSITIVE_INFINITY)).toBe(0);
    expect(leaguePoints(-500, -20)).toBe(0);
  });

  // Property 2: determinismo + não-negatividade + finitude
  it("Property 2: inteiro >= 0, determinístico", () => {
    fc.assert(
      fc.property(
        fc.option(fc.double({ min: -1000, max: 100000, noNaN: false }), { nil: null }),
        fc.option(fc.double({ min: -1000, max: 100000, noNaN: false }), { nil: null }),
        (d, e) => {
          const a = leaguePoints(d, e);
          const b = leaguePoints(d, e);
          return a === b && Number.isInteger(a) && a >= 0 && Number.isFinite(a);
        },
      ),
    );
  });
});

describe("sumLeaguePoints", () => {
  const acts: LeagueActivity[] = [
    { activityType: "pedalada", distanceMeters: 10000, elevationGain: 100 }, // 100+100=200
    { activityType: "corrida", distanceMeters: 5000, elevationGain: 20 }, // 50+20=70
    { activityType: "pedalada", distanceMeters: 2000, elevationGain: 0 }, // 20
  ];

  it("soma todas quando type = null (geral)", () => {
    expect(sumLeaguePoints(acts, null)).toBe(200 + 70 + 20);
  });

  it("Property 3: conta só o tipo pedido", () => {
    expect(sumLeaguePoints(acts, "pedalada")).toBe(200 + 20);
    expect(sumLeaguePoints(acts, "corrida")).toBe(70);
    expect(sumLeaguePoints(acts, "trilha")).toBe(0);
  });

  // Property 3 (property-based): soma por tipo <= soma geral, e a soma dos
  // tipos distintos == soma geral.
  it("Property 3: soma dos tipos == soma geral", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            activityType: fc.constantFrom("pedalada", "corrida", "trilha", "caminhada"),
            distanceMeters: fc.option(fc.double({ min: 0, max: 100000, noNaN: true }), { nil: null }),
            elevationGain: fc.option(fc.double({ min: 0, max: 5000, noNaN: true }), { nil: null }),
          }),
          { maxLength: 30 },
        ),
        (list) => {
          const geral = sumLeaguePoints(list, null);
          const tipos = ["pedalada", "corrida", "trilha", "caminhada"];
          const somaTipos = tipos.reduce((acc, t) => acc + sumLeaguePoints(list, t), 0);
          return geral === somaTipos;
        },
      ),
    );
  });
});
