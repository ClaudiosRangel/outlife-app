// Rota-Destino da comunidade (spec rota-destino-comunidade). Lógica PURA e
// testável (sem hook/Capacitor). Define categorias de aventura, modos de
// deslocamento e o mapeamento deslocamento → activity_type técnico, além de
// delegar a montagem do rascunho de destino para buildDestinationDraft (reuso).

import { buildDestinationDraft, type RecordedPoint, type DestinationDraft } from "@/lib/route-to-destination";

/** Categorias de aventura da Rota-Destino (tipo de lugar/experiência). */
export const ADVENTURE_CATEGORIES = [
  "cachoeira",
  "pico",
  "montanha",
  "parque",
  "trilha",
  "travessia",
  "escalada",
] as const;
export type AdventureCategory = (typeof ADVENTURE_CATEGORIES)[number];

/** Modo de deslocamento (exclusivo): a pé OU bicicleta. */
export const TRAVEL_MODES = ["foot", "bike"] as const;
export type TravelMode = (typeof TRAVEL_MODES)[number];

/**
 * Mapeia o modo de deslocamento para o activity_type técnico usado na gravação
 * e nos segmentos/KOM. Nunca retorna uma categoria de aventura.
 * - bike → "pedalada"
 * - foot → "trilha" (a Rota-Destino a pé é, tecnicamente, uma trilha)
 */
export function toActivityType(mode: TravelMode): "pedalada" | "trilha" {
  return mode === "bike" ? "pedalada" : "trilha";
}

/**
 * Monta o rascunho do destino a partir dos pontos gravados/reaproveitados.
 * Delega a buildDestinationDraft (mesma lógica de distância/geojson/elevação)
 * para não duplicar. Lança quando o trajeto tem < 2 pontos.
 */
export function buildAdventureDraft(points: RecordedPoint[]): DestinationDraft {
  return buildDestinationDraft(points);
}

export type { RecordedPoint, DestinationDraft };
