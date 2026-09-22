import { describe, it, expect } from "vitest";
import { buildPanorama, type PanoramaInput } from "./explore-panorama";

const rio = { lat: -22.9, lng: -43.2 };
const NOW = Date.parse("2026-09-15T12:00:00Z");

function base(): PanoramaInput {
  return {
    center: rio,
    friends: [
      { id: "f1", name: "Ana", lat: -22.91, lng: -43.21, activityType: "corrida" },
      { id: "f2", name: "Bia", lat: 0, lng: 0 }, // longe
    ],
    partners: [{ id: "p1", name: "Guia", lat: -22.92, lng: -43.19 }],
    destinations: [
      { id: "d1", name: "Pico", lat: -22.93, lng: -43.18, rating: 4.2 },
      { id: "d2", name: "Cachoeira", lat: -22.94, lng: -43.17, rating: 4.9 },
    ],
    trails: [{ id: "t1", name: "Trilha", lat: -22.95, lng: -43.16 }],
    events: [
      { id: "e1", title: "Passado", dateIso: "2026-09-10T12:00:00Z" },
      { id: "e2", title: "Próximo", dateIso: "2026-09-20T12:00:00Z" },
      { id: "e3", title: "Depois", dateIso: "2026-10-01T12:00:00Z" },
    ],
    nowMs: NOW,
  };
}

describe("explore-panorama", () => {
  it("conta apenas o que está perto do centro", () => {
    const p = buildPanorama(base());
    expect(p.counts.friendsLive).toBe(1); // Bia está longe
    expect(p.counts.partnersNearby).toBe(1);
    expect(p.counts.destinationsNearby).toBe(2);
    expect(p.counts.trailsNearby).toBe(1);
  });

  it("conta eventos futuros e escolhe o próximo", () => {
    const p = buildPanorama(base());
    expect(p.counts.eventsUpcoming).toBe(2); // e2 e e3
    expect(p.highlights.nextEvent?.id).toBe("e2");
  });

  it("destino em destaque é o melhor avaliado por perto", () => {
    const p = buildPanorama(base());
    expect(p.highlights.topDestination?.id).toBe("d2");
  });

  it("amigo mais próximo é calculado com distância", () => {
    const p = buildPanorama(base());
    expect(p.highlights.nearestFriend?.id).toBe("f1");
    expect(p.highlights.nearestFriend?.distanceKm).toBeGreaterThanOrEqual(0);
  });

  it("sem centro não quebra (panorama nacional)", () => {
    const input = { ...base(), center: null };
    const p = buildPanorama(input);
    expect(p.counts.friendsLive).toBe(2); // todos considerados
    expect(p.highlights.nextEvent?.id).toBe("e2");
  });
});
