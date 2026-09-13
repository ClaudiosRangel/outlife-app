import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { getActivityIcon, ICON_MODEL_SET } from "./activity-icons";
import { ParagliderIcon } from "@/components/icons/ParagliderIcon";
import { safeCount } from "./api";

// Property 6: voo livre (flight) usa o parapente; chave desconhecida → genérico.
describe("getActivityIcon (Property 6)", () => {
  it("flight resolve o ParagliderIcon (não o avião)", () => {
    expect(getActivityIcon("flight").Icon).toBe(ParagliderIcon);
  });

  it("chave desconhecida/nula cai no ícone genérico 'activity'", () => {
    const generic = getActivityIcon("activity").Icon;
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.constant(null), fc.constant(undefined)), (k) => {
        const known = ICON_MODEL_SET.some((m) => m.key === k);
        const resolved = getActivityIcon(k as string | null | undefined).Icon;
        if (!known) expect(resolved).toBe(generic);
        else expect(ICON_MODEL_SET.some((m) => m.Icon === resolved)).toBe(true);
      }),
    );
  });
});

// Property 4: safeCount sempre inteiro >= 0, nunca NaN.
describe("safeCount (Property 4)", () => {
  it("qualquer entrada vira inteiro >= 0", () => {
    fc.assert(
      fc.property(fc.oneof(fc.integer(), fc.double(), fc.constant(null), fc.constant(undefined)), (n) => {
        const r = safeCount(n as number | null | undefined);
        expect(Number.isInteger(r)).toBe(true);
        expect(r).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  it("valores válidos são preservados (floor)", () => {
    expect(safeCount(5)).toBe(5);
    expect(safeCount(5.9)).toBe(5);
    expect(safeCount(-3)).toBe(0);
    expect(safeCount(NaN)).toBe(0);
    expect(safeCount(null)).toBe(0);
  });
});
