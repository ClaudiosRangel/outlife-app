import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { parseDeepLink } from "./deep-link";

describe("parseDeepLink (Property 2 — Frente B)", () => {
  it("/a/<id> bem-formado → activity-preview com o id", () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        (id) => {
          const t = parseDeepLink(`https://outlife-app.vercel.app/a/${id}`);
          expect(t).toEqual({ kind: "activity-preview", activityId: id });
        },
      ),
    );
  });

  it("/atividade/<id> → activity-detail", () => {
    fc.assert(
      fc.property(fc.uuid(), (id) => {
        const t = parseDeepLink(`https://outlife-app.vercel.app/atividade/${id}`);
        expect(t).toEqual({ kind: "activity-detail", activityId: id });
      }),
    );
  });

  it("scheme outlife://atividade/<id> → activity-detail", () => {
    fc.assert(
      fc.property(fc.uuid(), (id) => {
        const t = parseDeepLink(`outlife://atividade/${id}`);
        expect(t).toEqual({ kind: "activity-detail", activityId: id });
      }),
    );
  });

  it("URL de auth (access_token no fragment) nunca vira atividade", () => {
    fc.assert(
      fc.property(fc.uuid(), fc.uuid(), (a, r) => {
        const url = `https://outlife-app.vercel.app/a/${a}#access_token=${r}&type=recovery`;
        const t = parseDeepLink(url);
        expect(t.kind).toBe("auth");
      }),
    );
  });

  it("path não-raiz → path; raiz/vazio → none", () => {
    expect(parseDeepLink("https://outlife-app.vercel.app/perfil").kind).toBe("path");
    expect(parseDeepLink("https://outlife-app.vercel.app/").kind).toBe("none");
    expect(parseDeepLink("").kind).toBe("none");
  });

  it("nunca lança para entradas arbitrárias", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(() => parseDeepLink(s)).not.toThrow();
      }),
    );
  });
});
