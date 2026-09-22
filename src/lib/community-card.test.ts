import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { buildCardMedia, formatLikeSummary } from "./community-card";

describe("community-card", () => {
  it("buildCardMedia mantém ordem mapa→foto→vídeo e omite ausentes", () => {
    expect(buildCardMedia({ mapSnapshotUrl: "m", imageUrl: "f", videoUrl: "v" })).toEqual([
      { kind: "map", url: "m" },
      { kind: "photo", url: "f" },
      { kind: "video", url: "v" },
    ]);
    expect(buildCardMedia({ imageUrl: "f" })).toEqual([{ kind: "photo", url: "f" }]);
    expect(buildCardMedia({ videoUrl: "v", mapSnapshotUrl: "m" })).toEqual([
      { kind: "map", url: "m" },
      { kind: "video", url: "v" },
    ]);
    expect(buildCardMedia({})).toEqual([]);
  });

  it("buildCardMedia ignora strings vazias/null", () => {
    expect(buildCardMedia({ mapSnapshotUrl: "", imageUrl: null, videoUrl: undefined })).toEqual([]);
  });

  it("formatLikeSummary nunca é negativo e é inteiro", () => {
    fc.assert(
      fc.property(fc.integer({ min: -100, max: 100000 }), (n) => {
        const out = Number(formatLikeSummary(n));
        expect(out).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(out)).toBe(true);
        if (n >= 0) expect(out).toBe(n);
        else expect(out).toBe(0);
      }),
    );
  });

  it("formatLikeSummary trata null/undefined como 0", () => {
    expect(formatLikeSummary(null)).toBe("0");
    expect(formatLikeSummary(undefined)).toBe("0");
  });
});
