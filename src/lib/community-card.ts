// Lógica pura do card da comunidade (spec comunidade-card-strava).
// Sem dependências de React para ser testável isoladamente.

export type CardMediaKind = "map" | "photo" | "video";
export type CardMedia = {
  kind: CardMediaKind;
  /** URL da mídia. Para vídeo, é o src; o poster é resolvido no componente. */
  url: string;
};

export type CardMediaInput = {
  mapSnapshotUrl?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
};

/**
 * Monta a lista ordenada de mídias do card: mapa → foto → vídeo, incluindo
 * apenas as que existem. Ordem estável e determinística (Req 5.1).
 */
export function buildCardMedia(input: CardMediaInput): CardMedia[] {
  const out: CardMedia[] = [];
  if (input.mapSnapshotUrl) out.push({ kind: "map", url: input.mapSnapshotUrl });
  if (input.imageUrl) out.push({ kind: "photo", url: input.imageUrl });
  if (input.videoUrl) out.push({ kind: "video", url: input.videoUrl });
  return out;
}

/**
 * Formata o total de curtidas para exibição compacta ao lado dos avatares.
 * Nunca negativo; inteiro.
 */
export function formatLikeSummary(count: number | null | undefined): string {
  const n = Math.max(0, Math.floor(Number(count ?? 0)));
  return String(n);
}
