import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { elapsedFromPoints, elapsedTotalSeconds, movingTimeSeconds } from "@/lib/activity-duration";

describe("elapsedFromPoints", () => {
  it("retorna 0 para vazio ou 1 ponto", () => {
    expect(elapsedFromPoints([])).toBe(0);
    expect(elapsedFromPoints([{ ts: 1000 }])).toBe(0);
  });

  it("calcula o span entre 1º e último ponto (segundos)", () => {
    expect(elapsedFromPoints([{ ts: 1_000 }, { ts: 61_000 }])).toBe(60);
  });

  it("nunca negativo para timestamps decrescentes", () => {
    expect(elapsedFromPoints([{ ts: 61_000 }, { ts: 1_000 }])).toBe(0);
  });
});

describe("elapsedTotalSeconds", () => {
  it("usa o tempo de relógio quando startedAt é válido", () => {
    // início em 0, fim em 100s, pontos cobrindo só 40s → total = 100
    const pts = [{ ts: 10_000 }, { ts: 50_000 }];
    expect(elapsedTotalSeconds(0, 100_000, pts)).toBe(100);
  });

  it("cai para o span dos pontos quando startedAt é null (retrocompat)", () => {
    const pts = [{ ts: 10_000 }, { ts: 70_000 }]; // 60s
    expect(elapsedTotalSeconds(null, 999_999, pts)).toBe(60);
  });

  it("cai para o span dos pontos quando startedAt/endMs são inválidos", () => {
    const pts = [{ ts: 0 }, { ts: 30_000 }]; // 30s
    expect(elapsedTotalSeconds(Number.NaN, 100_000, pts)).toBe(30);
    expect(elapsedTotalSeconds(0, Number.POSITIVE_INFINITY, pts)).toBe(30);
  });

  it("nunca fica abaixo do span dos pontos (piso)", () => {
    // relógio diz 10s, mas os pontos cobrem 40s → total = 40 (piso)
    const pts = [{ ts: 0 }, { ts: 40_000 }];
    expect(elapsedTotalSeconds(0, 10_000, pts)).toBe(40);
  });

  it("retorna 0 quando fim < início e sem pontos úteis", () => {
    expect(elapsedTotalSeconds(100_000, 0, [])).toBe(0);
  });

  // Property 1: não-negatividade e finitude
  it("Property 1: sempre inteiro >= 0, nunca NaN/Infinity", () => {
    fc.assert(
      fc.property(
        fc.option(fc.integer({ min: 0, max: 10 ** 12 }), { nil: null }),
        fc.integer({ min: 0, max: 10 ** 12 }),
        fc.array(fc.record({ ts: fc.integer({ min: 0, max: 10 ** 12 }) })),
        (startedAt, end, pts) => {
          const v = elapsedTotalSeconds(startedAt, end, pts);
          return Number.isInteger(v) && v >= 0 && Number.isFinite(v);
        },
      ),
    );
  });

  // Property 3: total sempre >= span dos pontos
  it("Property 3: total >= elapsedFromPoints", () => {
    fc.assert(
      fc.property(
        fc.option(fc.integer({ min: 0, max: 10 ** 12 }), { nil: null }),
        fc.integer({ min: 0, max: 10 ** 12 }),
        fc.array(fc.record({ ts: fc.integer({ min: 0, max: 10 ** 12 }) })),
        (startedAt, end, pts) => {
          return elapsedTotalSeconds(startedAt, end, pts) >= elapsedFromPoints(pts);
        },
      ),
    );
  });

  // Property 4: imunidade à suspensão do timer — depende só do relógio.
  // Para startedAt válido e end >= startedAt cobrindo mais que o span,
  // o resultado reflete o relógio (não um contador que teria congelado).
  it("Property 4: reflete o relógio (start..end) quando este domina o span", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 ** 9 }),
        fc.integer({ min: 0, max: 10 ** 6 }),
        (startedAt, deltaSec) => {
          const end = startedAt + deltaSec * 1000;
          // sem pontos → o total é exatamente o relógio
          return elapsedTotalSeconds(startedAt, end, []) === deltaSec;
        },
      ),
    );
  });
});

describe("movingTimeSeconds", () => {
  it("reproduz o bug real corrigido: Moving_Time nunca excede o Tempo Total", () => {
    // Cenário do print incoerente: timer inflado em ~7h (relógio somado na
    // restauração), mas o trajeto real (span dos pontos) foi curto.
    // Tempo total real = 7h06 (25617s). Moving_Time não pode passar disso,
    // e com o `min` fica limitado — o resumo deixa de mostrar 0,3 km/h falso.
    const pts = [{ ts: 0 }, { ts: 600_000 }]; // span 600s (10 min reais)
    const elapsedTotal = 25_617;
    // timer absurdo (25327s) — o que o bug produzia
    expect(movingTimeSeconds(25_327, pts, elapsedTotal)).toBe(25_327);
    // se o timer fosse limpo (só o span), o Moving_Time cai para 600s (correto)
    expect(movingTimeSeconds(0, pts, elapsedTotal)).toBe(600);
  });

  it("usa o maior entre timer e span dos pontos, limitado pelo total", () => {
    const pts = [{ ts: 0 }, { ts: 100_000 }]; // span 100s
    expect(movingTimeSeconds(60, pts, 200)).toBe(100); // span > timer
    expect(movingTimeSeconds(150, pts, 200)).toBe(150); // timer > span
    expect(movingTimeSeconds(300, pts, 200)).toBe(200); // ambos > total → limita ao total
  });

  it("trata valores inválidos sem NaN/Infinity", () => {
    expect(movingTimeSeconds(Number.NaN, [], 100)).toBe(0);
    expect(movingTimeSeconds(50, [], Number.POSITIVE_INFINITY)).toBe(0);
    expect(movingTimeSeconds(-5, [], 100)).toBe(0);
  });

  // Property crítica: a invariante do bug — Moving_Time <= Elapsed_Time, sempre.
  it("Property: 0 <= movingTime <= elapsedTotal, inteiro e finito", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10, max: 10 ** 9 }),
        fc.array(fc.record({ ts: fc.integer({ min: 0, max: 10 ** 12 }) })),
        fc.integer({ min: 0, max: 10 ** 9 }),
        (timer, pts, elapsed) => {
          const v = movingTimeSeconds(timer, pts, elapsed);
          return Number.isInteger(v) && v >= 0 && v <= Math.round(elapsed) && Number.isFinite(v);
        },
      ),
    );
  });
});
