import { describe, expect, it } from "vitest";
import { buildDirectionsUrl, buildMapSearchUrl, formatDistanceBR } from "./navigation-to";

describe("buildDirectionsUrl", () => {
  it("monta URL de direções com destino e travelmode driving por padrão", () => {
    const u = buildDirectionsUrl({ lat: -22.5, lng: -43.2 });
    expect(u).toContain("https://www.google.com/maps/dir/");
    expect(u).toContain("destination=-22.5%2C-43.2");
    expect(u).toContain("travelmode=driving");
    expect(u).not.toContain("origin=");
  });
  it("inclui origin quando informado", () => {
    const u = buildDirectionsUrl({ lat: -22.5, lng: -43.2 }, { lat: -22.9, lng: -43.1 });
    expect(u).toContain("origin=-22.9%2C-43.1");
  });
  it("respeita o travelmode", () => {
    expect(buildDirectionsUrl({ lat: 0, lng: 0 }, null, "walking")).toContain("travelmode=walking");
    expect(buildDirectionsUrl({ lat: 0, lng: 0 }, null, "bicycling")).toContain("travelmode=bicycling");
  });
});

describe("buildMapSearchUrl", () => {
  it("monta URL de busca por coordenada", () => {
    expect(buildMapSearchUrl({ lat: -22.5, lng: -43.2 })).toBe(
      "https://www.google.com/maps/search/?api=1&query=-22.5,-43.2",
    );
  });
});

describe("formatDistanceBR", () => {
  it("metros abaixo de 1 km", () => {
    expect(formatDistanceBR(0)).toBe("0 m");
    expect(formatDistanceBR(850)).toBe("850 m");
  });
  it("km com uma casa (vírgula) até 100 km", () => {
    expect(formatDistanceBR(12340)).toBe("12,3 km");
  });
  it("km inteiro acima de 100 km", () => {
    expect(formatDistanceBR(563300)).toBe("563 km");
  });
  it("entrada inválida vira travessão", () => {
    expect(formatDistanceBR(-1)).toBe("—");
    expect(formatDistanceBR(NaN)).toBe("—");
  });
});
