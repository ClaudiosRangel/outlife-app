// Modelo puro do estado da tela de busca de destinos (Google Places),
// usado pelo SPA_Build_Target quando a busca passa a depender de uma
// chamada HTTP remota em vez da server function local (ver
// src/services/external-api.ts).
//
// Requirement 1.7: se a chamada ao endpoint remoto equivalente falhar (erro
// de rede ou erro do servidor), a tela deve exibir uma indicação de erro
// observável e preservar o estado anterior à tentativa — nunca falhar
// silenciosamente nem descartar os resultados já carregados.
//
// `applySearchOutcome` é a única fonte de verdade para essa transição de
// estado, independente de onde a busca é disparada (útil também como base
// da Property 2 do design.md).

import type { GooglePlacesDestination } from "@/services/external-api";

/**
 * Estado de tela válido: já possui (ou pode possuir, no caso vazio inicial)
 * resultados carregados, e um campo de erro observável separado — nunca um
 * booleano que force a UI a escolher entre exibir resultados OU erro.
 */
export interface DestinationSearchState {
  /** Resultados atualmente exibidos na tela. */
  results: GooglePlacesDestination[];
  /** Indicação de erro observável pela UI; `null` quando a última tentativa não falhou. */
  error: string | null;
}

/** Resultado de uma tentativa de busca de destinos. */
export type SearchOutcome =
  | { type: "success"; results: GooglePlacesDestination[] }
  | { type: "error"; message: string };

/**
 * Aplica o resultado de uma tentativa de busca ao estado anterior da tela.
 *
 * - Em caso de sucesso: substitui os resultados pelos novos e limpa o erro.
 * - Em caso de erro: retorna exatamente o mesmo `previousState` (incluindo
 *   `results`), acrescido apenas do campo `error` com a mensagem observável
 *   — os resultados já carregados nunca são descartados nem alterados.
 */
export function applySearchOutcome(
  previousState: DestinationSearchState,
  outcome: SearchOutcome,
): DestinationSearchState {
  if (outcome.type === "success") {
    return { results: outcome.results, error: null };
  }
  return { ...previousState, error: outcome.message };
}
