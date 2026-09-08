import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  MAX_VIDEO_BYTES,
  MAX_VIDEO_DURATION_SECONDS,
  ALLOWED_VIDEO_TYPES,
  validateVideoFileMeta,
  validateVideoDuration,
  videoRejectionMessage,
  type VideoValidationResult,
} from "./video-validation";

const allowedMimes = Object.keys(ALLOWED_VIDEO_TYPES);

describe("validateVideoFileMeta — tipo", () => {
  it("aceita tipos permitidos e retorna a extensão correta", () => {
    for (const mime of allowedMimes) {
      const r = validateVideoFileMeta({ type: mime, size: 1024 });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.ext).toBe(ALLOWED_VIDEO_TYPES[mime]);
    }
  });

  it("recusa tipo não permitido com reason 'type'", () => {
    for (const mime of ["image/png", "video/avi", "application/pdf", ""]) {
      const r = validateVideoFileMeta({ type: mime, size: 1024 });
      expect(r).toEqual({ ok: false, reason: "type" });
    }
  });
});

describe("validateVideoFileMeta — tamanho (bordas)", () => {
  it("aceita exatamente no limite", () => {
    const r = validateVideoFileMeta({ type: "video/mp4", size: MAX_VIDEO_BYTES });
    expect(r.ok).toBe(true);
  });

  it("recusa 1 byte acima do limite com reason 'size'", () => {
    const r = validateVideoFileMeta({ type: "video/mp4", size: MAX_VIDEO_BYTES + 1 });
    expect(r).toEqual({ ok: false, reason: "size" });
  });

  it("recusa tamanho negativo/não-finito", () => {
    for (const size of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = validateVideoFileMeta({ type: "video/mp4", size });
      expect(r).toEqual({ ok: false, reason: "size" });
    }
  });
});

describe("validateVideoDuration", () => {
  it("aceita dentro do limite (incluindo o próprio limite)", () => {
    for (const s of [0.5, 1, 30, MAX_VIDEO_DURATION_SECONDS]) {
      expect(validateVideoDuration(s)).toEqual({ ok: true });
    }
  });

  it("recusa acima do limite", () => {
    expect(validateVideoDuration(MAX_VIDEO_DURATION_SECONDS + 0.1)).toEqual({ ok: false });
  });

  it("recusa duração indeterminável (não-finita, zero, negativa) — Req 2.5", () => {
    for (const s of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(validateVideoDuration(s)).toEqual({ ok: false });
    }
  });
});

describe("Property: validação é total e tipada (nunca lança)", () => {
  it("validateVideoFileMeta sempre retorna resultado tipado", () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.oneof(fc.integer(), fc.double(), fc.constant(Number.NaN)),
        (type, size) => {
          let r: VideoValidationResult;
          expect(() => {
            r = validateVideoFileMeta({ type, size });
          }).not.toThrow();
          r = validateVideoFileMeta({ type, size });
          if (r.ok) {
            expect(typeof r.ext).toBe("string");
            expect(allowedMimes).toContain(type);
          } else {
            expect(["type", "size", "duration"]).toContain(r.reason);
          }
        },
      ),
    );
  });

  it("validateVideoDuration sempre retorna { ok: boolean }", () => {
    fc.assert(
      fc.property(fc.oneof(fc.double(), fc.integer(), fc.constant(Number.NaN)), (s) => {
        const r = validateVideoDuration(s);
        expect(typeof r.ok).toBe("boolean");
        // Coerência: só ok quando finito, >0 e <= max.
        const shouldBeOk = Number.isFinite(s) && s > 0 && s <= MAX_VIDEO_DURATION_SECONDS;
        expect(r.ok).toBe(shouldBeOk);
      }),
    );
  });
});

describe("videoRejectionMessage", () => {
  it("retorna mensagem não-vazia para cada motivo", () => {
    for (const reason of ["type", "size", "duration"] as const) {
      expect(videoRejectionMessage(reason).length).toBeGreaterThan(0);
    }
  });
});
