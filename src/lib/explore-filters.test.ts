import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { applyDestinationFilters, hasActiveFilters, EMPTY_FILTERS, type DestinationFilterInput, type ExploreFilters } from "@/lib/explore-filters";

const LIST: DestinationFilterInput[] = [
  { id: "1", name: "Cachoeira Alta", region: "Cachoeiro de Itapemirim", difficulty: "Fácil", category: "cachoeira", isPaid: true, petFriendly: false },
  { id: "2", name: "Pico da Bandeira", region: "Caparaó", difficulty: "Difícil", category: "pico", isPaid: false, petFriendly: true },
  { id: "3", name: "Trilha do Sino", region: "Petrópolis", difficulty: "Moderada", category: "trilha", isPaid: false, petFriendly: false },
];

describe("applyDestinationFilters", () => {
  it("sem filtros → retorna tudo", () => {
    expect(applyDestinationFilters(LIST, EMPTY_FILTERS)).toHaveLength(3);
  });

  it("busca por nome (sem acento, case-insensitive)", () => {
    expect(applyDestinationFilters(LIST, { ...EMPTY_FILTERS, query: "cachoeira" }).map((d) => d.id)).toEqual(["1"]);
    expect(applyDestinationFilters(LIST, { ...EMPTY_FILTERS, query: "PICO" }).map((d) => d.id)).toEqual(["2"]);
  });

  it("filtra por dificuldade / categoria", () => {
    expect(applyDestinationFilters(LIST, { ...EMPTY_FILTERS, difficulty: "Difícil" }).map((d) => d.id)).toEqual(["2"]);
    expect(applyDestinationFilters(LIST, { ...EMPTY_FILTERS, category: "trilha" }).map((d) => d.id)).toEqual(["3"]);
  });

  it("pet-friendly / pago-grátis", () => {
    expect(applyDestinationFilters(LIST, { ...EMPTY_FILTERS, petFriendly: true }).map((d) => d.id)).toEqual(["2"]);
    expect(applyDestinationFilters(LIST, { ...EMPTY_FILTERS, paid: "free" }).map((d) => d.id)).toEqual(["2", "3"]);
    expect(applyDestinationFilters(LIST, { ...EMPTY_FILTERS, paid: "paid" }).map((d) => d.id)).toEqual(["1"]);
  });

  it("rotas que curti (savedIds)", () => {
    expect(applyDestinationFilters(LIST, { ...EMPTY_FILTERS, savedIds: ["3"] }).map((d) => d.id)).toEqual(["3"]);
    expect(applyDestinationFilters(LIST, { ...EMPTY_FILTERS, savedIds: [] })).toHaveLength(0);
  });

  it("região (contém)", () => {
    expect(applyDestinationFilters(LIST, { ...EMPTY_FILTERS, region: "petropolis" }).map((d) => d.id)).toEqual(["3"]);
  });

  it("hasActiveFilters", () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, category: "pico" })).toBe(true);
  });

  // Property 3: resultado é subconjunto e idempotente
  it("Property 3: subconjunto + idempotente", () => {
    const arbFilter: fc.Arbitrary<ExploreFilters> = fc.record({
      query: fc.constantFrom("", "cachoeira", "pico", "xyz"),
      region: fc.constantFrom("", "petropolis", "caparao"),
      difficulty: fc.constantFrom(null, "Fácil", "Difícil", "Moderada"),
      category: fc.constantFrom(null, "cachoeira", "pico", "trilha"),
      petFriendly: fc.boolean(),
      paid: fc.constantFrom("all" as const, "free" as const, "paid" as const),
      savedIds: fc.constantFrom(null, [] as string[], ["1"], ["1", "3"]),
    });
    fc.assert(
      fc.property(arbFilter, (f) => {
        const r1 = applyDestinationFilters(LIST, f);
        // subconjunto: todo item de r1 está em LIST
        const subset = r1.every((x) => LIST.some((y) => y.id === x.id));
        // idempotente: aplicar de novo sobre r1 com o mesmo filtro dá o mesmo
        const r2 = applyDestinationFilters(r1, f);
        const idem = r2.length === r1.length && r2.every((x, i) => x.id === r1[i].id);
        return subset && idem && r1.length <= LIST.length;
      }),
    );
  });
});
