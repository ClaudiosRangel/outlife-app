// Resumo em linguagem natural do panorama do Explorar (spec explorar-redesign,
// fase 3). Puro/testável — monta um parágrafo a partir do panorama + clima.
import type { Panorama } from "@/lib/explore-panorama";
import type { OutdoorVerdict } from "@/lib/weather";

export type SummaryInput = {
  regionName?: string | null;
  temperatureC?: number | null;
  verdict?: OutdoorVerdict | null;
  panorama: Panorama;
};

/**
 * Gera um resumo curto em português, ex.:
 * "Hoje está bom para atividades ao ar livre em Juiz de Fora: 24°. 2 amigos
 *  ativos agora e 1 evento chegando. Destaque: Pedra do Sino."
 * Determinístico (sem aleatoriedade) para ser testável.
 */
export function buildExploreSummary(input: SummaryInput): string {
  const { regionName, temperatureC, verdict, panorama } = input;
  const parts: string[] = [];

  const region = regionName?.trim() ? ` em ${regionName.trim()}` : "";
  const verdictText =
    verdict === "good"
      ? "Ótimo dia para atividades ao ar livre"
      : verdict === "caution"
        ? "Dá para se aventurar com atenção ao tempo"
        : verdict === "avoid"
          ? "Tempo desfavorável para atividades ao ar livre"
          : "Que tal explorar";
  const temp = typeof temperatureC === "number" ? `: ${temperatureC}°` : "";
  parts.push(`${verdictText}${region}${temp}.`);

  const c = panorama.counts;
  const social: string[] = [];
  if (c.friendsLive > 0) social.push(`${c.friendsLive} ${c.friendsLive === 1 ? "amigo ativo" : "amigos ativos"} agora`);
  if (c.eventsUpcoming > 0) social.push(`${c.eventsUpcoming} ${c.eventsUpcoming === 1 ? "evento chegando" : "eventos chegando"}`);
  if (c.partnersNearby > 0) social.push(`${c.partnersNearby} ${c.partnersNearby === 1 ? "parceiro por perto" : "parceiros por perto"}`);
  const places = c.destinationsNearby + c.trailsNearby;
  if (places > 0) social.push(`${places} ${places === 1 ? "lugar para explorar" : "lugares para explorar"}`);

  if (social.length > 0) {
    parts.push(joinNatural(social) + ".");
  } else {
    parts.push("Nada acontecendo por aqui ainda — seja o primeiro a se movimentar.");
  }

  if (panorama.highlights.topDestination) {
    parts.push(`Destaque: ${panorama.highlights.topDestination.name}.`);
  }

  return parts.join(" ");
}

/** Junta itens com vírgulas e "e" antes do último (pt-BR). */
function joinNatural(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return capitalize(items[0]);
  const head = items.slice(0, -1).join(", ");
  return capitalize(`${head} e ${items[items.length - 1]}`);
}

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}
