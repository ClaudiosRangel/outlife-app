import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { computeTrialStatus, TRIAL_DURATION_DAYS } from "./partner-trial";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("computeTrialStatus (Property 1 — Frente A)", () => {
  it("dentro da janela de 365 dias → trialActive=true", () => {
    fc.assert(
      fc.property(
        // start entre 2020 e 2030
        fc.integer({ min: Date.UTC(2020, 0, 1), max: Date.UTC(2030, 0, 1) }),
        // deslocamento em dias dentro do trial [0, 364]
        fc.integer({ min: 0, max: TRIAL_DURATION_DAYS - 1 }),
        (startMs, offsetDays) => {
          const startedAt = new Date(startMs).toISOString();
          const now = startMs + offsetDays * DAY_MS;
          const s = computeTrialStatus(startedAt, now);
          expect(s.trialActive).toBe(true);
          expect(s.remainingDays).toBeGreaterThan(0);
          expect(s.remainingDays).toBeLessThanOrEqual(TRIAL_DURATION_DAYS + 1);
        },
      ),
    );
  });

  it("após 365 dias → trialActive=false e remainingDays=0", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: Date.UTC(2020, 0, 1), max: Date.UTC(2030, 0, 1) }),
        fc.integer({ min: TRIAL_DURATION_DAYS, max: TRIAL_DURATION_DAYS + 1000 }),
        (startMs, offsetDays) => {
          const startedAt = new Date(startMs).toISOString();
          const now = startMs + offsetDays * DAY_MS;
          const s = computeTrialStatus(startedAt, now);
          expect(s.trialActive).toBe(false);
          expect(s.remainingDays).toBe(0);
        },
      ),
    );
  });

  it("remainingDays é inteiro em [0, 366] e nunca NaN/Infinity", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: Date.UTC(2020, 0, 1), max: Date.UTC(2030, 0, 1) }),
        fc.integer({ min: -1000, max: TRIAL_DURATION_DAYS + 1000 }),
        (startMs, offsetDays) => {
          const startedAt = new Date(startMs).toISOString();
          const now = startMs + offsetDays * DAY_MS;
          const s = computeTrialStatus(startedAt, now);
          expect(Number.isInteger(s.remainingDays)).toBe(true);
          expect(s.remainingDays).toBeGreaterThanOrEqual(0);
          expect(s.remainingDays).toBeLessThanOrEqual(TRIAL_DURATION_DAYS + 1);
          expect(Number.isFinite(s.elapsedFraction)).toBe(true);
          expect(s.elapsedFraction).toBeGreaterThanOrEqual(0);
          expect(s.elapsedFraction).toBeLessThanOrEqual(1);
        },
      ),
    );
  });

  it("remainingDays é monotonicamente não-crescente conforme o tempo avança", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: Date.UTC(2020, 0, 1), max: Date.UTC(2030, 0, 1) }),
        fc.integer({ min: 0, max: TRIAL_DURATION_DAYS }),
        fc.integer({ min: 0, max: 30 }),
        (startMs, offsetDays, extraDays) => {
          const startedAt = new Date(startMs).toISOString();
          const t1 = startMs + offsetDays * DAY_MS;
          const t2 = t1 + extraDays * DAY_MS;
          const s1 = computeTrialStatus(startedAt, t1);
          const s2 = computeTrialStatus(startedAt, t2);
          expect(s2.remainingDays).toBeLessThanOrEqual(s1.remainingDays);
        },
      ),
    );
  });

  it("entrada inválida nunca produz NaN e resulta em trial inativo", () => {
    for (const bad of [null, undefined, "", "não-é-data", "2026-13-99"]) {
      const s = computeTrialStatus(bad, Date.now());
      expect(s.trialActive).toBe(false);
      expect(s.remainingDays).toBe(0);
      expect(Number.isFinite(s.elapsedFraction)).toBe(true);
    }
  });
});
