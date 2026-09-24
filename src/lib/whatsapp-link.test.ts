import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { normalizePhoneBR, buildWhatsAppUrl, buildEventMessage, buildEventInviteUrl } from "./whatsapp-link";

describe("normalizePhoneBR", () => {
  it("adiciona DDI 55 a celular/fixo BR", () => {
    expect(normalizePhoneBR("(32) 99999-0000")).toBe("5532999990000");
    expect(normalizePhoneBR("3233330000")).toBe("553233330000");
  });
  it("mantém quando já tem 55", () => {
    expect(normalizePhoneBR("5532999990000")).toBe("5532999990000");
  });
  it("null para vazio/curto", () => {
    expect(normalizePhoneBR("")).toBeNull();
    expect(normalizePhoneBR(null)).toBeNull();
    expect(normalizePhoneBR("123")).toBeNull();
  });
});

describe("buildWhatsAppUrl", () => {
  it("com número usa wa.me/<num>", () => {
    const u = buildWhatsAppUrl("oi", "(32) 99999-0000");
    expect(u.startsWith("https://wa.me/5532999990000?text=")).toBe(true);
  });
  it("sem número usa seletor de contato", () => {
    const u = buildWhatsAppUrl("oi", null);
    expect(u.startsWith("https://wa.me/?text=")).toBe(true);
  });
  it("sempre codifica o texto (nunca quebra a URL)", () => {
    fc.assert(
      fc.property(fc.string(), (msg) => {
        const u = buildWhatsAppUrl(msg);
        expect(u.startsWith("https://wa.me/?text=")).toBe(true);
        // decodifica de volta = mensagem original.
        expect(decodeURIComponent(u.split("text=")[1])).toBe(msg);
      }),
    );
  });
});

describe("buildEventMessage", () => {
  it("convite tem título e é diferente do lembrete", () => {
    const inv = buildEventMessage({ title: "Trilha X", dateIso: "2026-10-01T09:00:00Z" });
    const rem = buildEventMessage({ title: "Trilha X", dateIso: "2026-10-01T09:00:00Z", reminder: true });
    expect(inv).toContain("Trilha X");
    expect(rem).toContain("Lembrete");
    expect(inv).not.toBe(rem);
  });
  it("inclui local quando há meetingPoint/city", () => {
    const m = buildEventMessage({ title: "T", meetingPoint: "Lapa", city: "RJ" });
    expect(m).toContain("Lapa");
    expect(m).toContain("RJ");
  });
});

describe("buildEventInviteUrl", () => {
  it("gera URL válida do WhatsApp", () => {
    const u = buildEventInviteUrl({ title: "Trilha" });
    expect(u.startsWith("https://wa.me/")).toBe(true);
    expect(u).toContain("text=");
  });
});
