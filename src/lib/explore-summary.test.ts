import { describe, it, expect } from "vitest";
import { buildExploreSummary } from "./explore-summary";
import type { Panorama } from "./explore-panorama";

function panorama(overrides?: Partial<Panorama>): Panorama {
  return {
    counts: { friendsLive: 0, eventsUpcoming: 0, partnersNearby: 0, destinationsNearby: 0, trailsNearby: 0 },
    highlights: { nextEvent: null, nearestFriend: null, topDestination: null },
    ...overrides,
  };
}

describe("explore-summary", () => {
  it("inclui região e temperatura com veredito bom", () => {
    const s = buildExploreSummary({
      regionName: "Juiz de Fora",
      temperatureC: 24,
      verdict: "good",
      panorama: panorama({ counts: { friendsLive: 2, eventsUpcoming: 1, partnersNearby: 0, destinationsNearby: 0, trailsNearby: 0 } }),
    });
    expect(s).toContain("Juiz de Fora");
    expect(s).toContain("24°");
    expect(s).toContain("2 amigos ativos");
    expect(s).toContain("1 evento chegando");
  });

  it("mensagem de vazio quando não há nada", () => {
    const s = buildExploreSummary({ panorama: panorama(), verdict: "good" });
    expect(s.toLowerCase()).toContain("nada acontecendo");
  });

  it("inclui destaque quando há topDestination", () => {
    const s = buildExploreSummary({
      panorama: panorama({
        counts: { friendsLive: 0, eventsUpcoming: 0, partnersNearby: 1, destinationsNearby: 1, trailsNearby: 0 },
        highlights: { nextEvent: null, nearestFriend: null, topDestination: { id: "d1", name: "Pedra do Sino", lat: 0, lng: 0, rating: 5 } },
      }),
      verdict: "caution",
    });
    expect(s).toContain("Pedra do Sino");
    expect(s).toContain("atenção");
  });

  it("singular/plural corretos", () => {
    const s = buildExploreSummary({
      panorama: panorama({ counts: { friendsLive: 1, eventsUpcoming: 0, partnersNearby: 0, destinationsNearby: 0, trailsNearby: 1 } }),
      verdict: "good",
    });
    expect(s).toContain("1 amigo ativo");
    expect(s).toContain("1 lugar para explorar");
  });
});
