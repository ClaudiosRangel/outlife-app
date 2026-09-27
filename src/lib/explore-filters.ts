// Filtros do Explorar (Bloco 3, Fase C). PURO e testável: aplica os filtros
// escolhidos no painel sobre a lista de destinos. Nunca inventa itens (o
// resultado é sempre subconjunto da entrada) e é idempotente.

export type DestinationFilterInput = {
  id: string;
  name: string;
  region: string;
  difficulty: string;
  category: string | null;
  isPaid: boolean | null;
  petFriendly: boolean | null;
};

export type ExploreFilters = {
  query: string;            // busca por nome
  region: string;           // cidade/região (contém, case-insensitive)
  difficulty: string | null; // "Fácil" | "Moderada" | "Difícil" | ... | null
  category: string | null;  // "cachoeira" | "pico" | ... | null
  petFriendly: boolean;     // true = só pet-friendly
  paid: "all" | "free" | "paid";
  savedIds: string[] | null; // quando "rotas que curti": só esses ids
};

export const EMPTY_FILTERS: ExploreFilters = {
  query: "",
  region: "",
  difficulty: null,
  category: null,
  petFriendly: false,
  paid: "all",
  savedIds: null,
};

function norm(s: string): string {
  return s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Aplica os filtros. Retorna um SUBCONJUNTO da lista (Property 3).
 * Determinístico e idempotente para o mesmo filtro.
 */
export function applyDestinationFilters<T extends DestinationFilterInput>(
  list: T[],
  f: ExploreFilters,
): T[] {
  const q = norm(f.query);
  const reg = norm(f.region);
  return list.filter((d) => {
    if (q && !norm(d.name).includes(q)) return false;
    if (reg && !norm(d.region).includes(reg)) return false;
    if (f.difficulty && d.difficulty !== f.difficulty) return false;
    if (f.category && d.category !== f.category) return false;
    if (f.petFriendly && d.petFriendly !== true) return false;
    if (f.paid === "free" && d.isPaid === true) return false;
    if (f.paid === "paid" && d.isPaid !== true) return false;
    if (f.savedIds && !f.savedIds.includes(d.id)) return false;
    return true;
  });
}

/** true quando há qualquer filtro ativo (para badge no botão de filtros). */
export function hasActiveFilters(f: ExploreFilters): boolean {
  return (
    f.query.trim() !== "" ||
    f.region.trim() !== "" ||
    f.difficulty != null ||
    f.category != null ||
    f.petFriendly ||
    f.paid !== "all" ||
    f.savedIds != null
  );
}
