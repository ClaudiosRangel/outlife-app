import { describe, it, expect, vi } from "vitest";
import { createObjectUrlManager } from "@/lib/object-url-preview";

function makeDeps() {
  let counter = 0;
  const create = vi.fn((_f: Blob) => `blob:url-${++counter}`);
  const revoke = vi.fn((_u: string) => {});
  return { create, revoke };
}

const file = new Blob(["x"]) as unknown as Blob;

describe("createObjectUrlManager (Req 1)", () => {
  it("usa create ao definir preview (Property 1: sem base64, só createObjectURL)", () => {
    const deps = makeDeps();
    const m = createObjectUrlManager(deps);
    const url = m.set(file);
    expect(deps.create).toHaveBeenCalledTimes(1);
    expect(url).toBe("blob:url-1");
    expect(m.current()).toBe("blob:url-1");
  });

  it("revoga o URL anterior antes de criar um novo (Req 1.3, Property 2)", () => {
    const deps = makeDeps();
    const m = createObjectUrlManager(deps);
    m.set(file); // url-1
    m.set(file); // url-2, deve revogar url-1
    expect(deps.revoke).toHaveBeenCalledTimes(1);
    expect(deps.revoke).toHaveBeenCalledWith("blob:url-1");
    expect(m.current()).toBe("blob:url-2");
  });

  it("revoga o URL atual ao limpar (Req 1.2)", () => {
    const deps = makeDeps();
    const m = createObjectUrlManager(deps);
    m.set(file);
    m.clear();
    expect(deps.revoke).toHaveBeenCalledTimes(1);
    expect(m.current()).toBeNull();
  });

  it("não revoga nada ao limpar sem URL vigente (sem dupla revogação)", () => {
    const deps = makeDeps();
    const m = createObjectUrlManager(deps);
    m.clear();
    m.clear();
    expect(deps.revoke).not.toHaveBeenCalled();
  });

  it("Property 2: cada URL criado é revogado exatamente uma vez ao longo do ciclo", () => {
    const deps = makeDeps();
    const m = createObjectUrlManager(deps);
    // sequência: set, set, set, clear → 3 criados, 3 revogados
    m.set(file);
    m.set(file);
    m.set(file);
    m.clear();
    expect(deps.create).toHaveBeenCalledTimes(3);
    expect(deps.revoke).toHaveBeenCalledTimes(3);
    // nenhum URL revogado duas vezes
    const revokedArgs = deps.revoke.mock.calls.map((c) => c[0]);
    expect(new Set(revokedArgs).size).toBe(revokedArgs.length);
  });
});
