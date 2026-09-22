import { describe, it, expect, vi, afterEach } from "vitest";

// Testa a decisão de provider conforme o token. Como import.meta.env é
// congelado, mockamos o módulo lendo via vi.stubEnv.

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("map-config", () => {
  it("hasMapbox=false quando token ausente/vazio", async () => {
    vi.stubEnv("VITE_MAPBOX_TOKEN", "");
    const mod = await import("./map-config");
    expect(mod.getMapboxToken()).toBeNull();
    expect(mod.hasMapbox()).toBe(false);
  });

  it("hasMapbox=true quando token presente", async () => {
    vi.stubEnv("VITE_MAPBOX_TOKEN", "pk.abc123");
    const mod = await import("./map-config");
    expect(mod.getMapboxToken()).toBe("pk.abc123");
    expect(mod.hasMapbox()).toBe(true);
  });
});
