import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  sortRanking,
  formatRankingValue,
  periodStartIso,
  type RankingRow,
  type RankingMetric,
} from "./ranking-format";

function row(userId: string, value: number): RankingRow {
  return { userId, fullName: null, username: null, avatarUrl: null, value };
}

describe("sortRanking — ordem por métrica", () => {
  it("distancia/altimetria: decrescente", () => {
    const rows = [row("a", 10), row("b", 30), row("c", 20)];
    expect(sortRanking(rows, "distancia").map((r) => r.userId)).toEqual(["b", "c", "a"]);
    expect(sortRanking(rows, "altimetria").map((r) => r.userId)).toEqual(["b", "c", "a"]);
  });

  it("tempo: crescente (menor primeiro)", () => {
    const rows = [row("a", 300), row("b", 100), row("c", 200)];
    expect(sortRanking(rows, "tempo").map((r) => r.userId)).toEqual(["b", "c", "a"]);
  });

  it("desempate estável por userId", () => {
    const rows = [row("z", 100), row("a", 100), row("m", 100)];
    expect(sortRanking(rows, "distancia").map((r) => r.userId)).toEqual(["a", "m", "z"]);
  });

  it("não muta o array de entrada", () => {
    const rows = [row("a", 1), row("b", 2)];
    const copy = [...rows];
    sortRanking(rows, "distancia");
    expect(rows).toEqual(copy);
  });
});

describe("formatRankingValue", () => {
  it("distancia", () => {
    expect(formatRankingValue(850, "distancia")).toBe("850 m");
    expect(formatRankingValue(12340, "distancia")).toBe("12,3 km");
  });
  it("altimetria", () => {
    expect(formatRankingValue(1234.7, "altimetria")).toBe("1235 m");
  });
  it("tempo", () => {
    expect(formatRankingValue(90, "tempo")).toBe("1:30");
    expect(formatRankingValue(3661, "tempo")).toBe("1:01:01");
  });
  it("valores inválidos → tratados como 0", () => {
    for (const m of ["distancia", "altimetria", "tempo"] as RankingMetric[]) {
      expect(formatRankingValue(Number.NaN, m).length).toBeGreaterThan(0);
      expect(formatRankingValue(-5, m).length).toBeGreaterThan(0);
    }
  });
});

describe("periodStartIso", () => {
  it("sempre → null", () => {
    expect(periodStartIso("sempre", new Date())).toBeNull();
  });
  it("mes → dia 1 00:00 local", () => {
    const iso = periodStartIso("mes", new Date(2026, 8, 15, 13, 30)); // 15/set/2026
    const d = new Date(iso!);
    expect(d.getDate()).toBe(1);
    expect(d.getMonth()).toBe(8);
    expect(d.getHours()).toBe(0);
  });
  it("ano → 1/jan 00:00 local", () => {
    const iso = periodStartIso("ano", new Date(2026, 8, 15));
    const d = new Date(iso!);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(1);
  });
  it("semana → segunda-feira", () => {
    // 2026-09-15 é uma terça; segunda da semana = 2026-09-14.
    const iso = periodStartIso("semana", new Date(2026, 8, 15, 10, 0));
    const d = new Date(iso!);
    expect(d.getDay()).toBe(1); // segunda
    expect(d.getDate()).toBe(14);
  });
});

describe("Property 4: ordenação respeita a métrica", () => {
  it("distancia desc, tempo asc", () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.string({ minLength: 1 }), fc.double({ min: 0, max: 1e6, noNaN: true })), { minLength: 1, maxLength: 20 }),
        (pairs) => {
          const rows = pairs.map(([id, v], i) => row(`${id}-${i}`, v));
          const desc = sortRanking(rows, "distancia");
          for (let i = 1; i < desc.length; i++) {
            expect(desc[i - 1].value).toBeGreaterThanOrEqual(desc[i].value);
          }
          const asc = sortRanking(rows, "tempo");
          for (let i = 1; i < asc.length; i++) {
            expect(asc[i - 1].value).toBeLessThanOrEqual(asc[i].value);
          }
        },
      ),
    );
  });
});

describe("Property 6: formatação nunca produz valor inválido", () => {
  it("string não-vazia sem NaN/Infinity para valor finito >= 0", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1e7, noNaN: true }),
        fc.constantFrom<RankingMetric>("distancia", "tempo", "altimetria"),
        (value, metric) => {
          const s = formatRankingValue(value, metric);
          expect(typeof s).toBe("string");
          expect(s.length).toBeGreaterThan(0);
          expect(s).not.toContain("NaN");
          expect(s).not.toContain("Infinity");
        },
      ),
    );
  });
});
