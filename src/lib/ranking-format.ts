// Formatação e ordenação puras de ranking (spec gamificacao-niveis-rank,
// item 12). A agregação/consulta vive no banco (RPC SECURITY DEFINER); estas
// funções puras cuidam da ordenação determinística (salvaguarda + desempate),
// da formatação de exibição e do cálculo determinístico da janela de período
// (mesma regra usada para passar `_since` à RPC — Req 5.3).

export type RankingMetric = "distancia" | "tempo" | "altimetria";
export type RankingScope = "global" | "seguidos";
export type RankingPeriod = "semana" | "mes" | "ano" | "sempre";

export interface RankingRow {
  userId: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  /** metros (distancia/altimetria) ou segundos (tempo). */
  value: number;
}

/**
 * Ordena as linhas conforme a métrica: decrescente para distancia/altimetria
 * (maior é melhor), crescente para tempo (menor é melhor). Desempate estável
 * por `userId` para determinismo (Req 3.2). Não muta o array de entrada.
 */
export function sortRanking(rows: RankingRow[], metric: RankingMetric): RankingRow[] {
  const asc = metric === "tempo";
  return [...rows].sort((a, b) => {
    const av = Number.isFinite(a.value) ? a.value : asc ? Infinity : -Infinity;
    const bv = Number.isFinite(b.value) ? b.value : asc ? Infinity : -Infinity;
    if (av !== bv) return asc ? av - bv : bv - av;
    // Desempate estável e determinístico.
    return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0;
  });
}

/** Formata metros como "12,3 km" (>=1km) ou "850 m". */
function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
  return `${Math.round(meters)} m`;
}

/** Formata segundos como mm:ss (<1h) ou h:mm:ss. */
function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/**
 * Formata o valor da métrica para exibição. Total: qualquer valor finito ≥ 0
 * retorna string não-vazia; valores inválidos são tratados como 0 (Req 3.5/7.1).
 */
export function formatRankingValue(value: number, metric: RankingMetric): string {
  const v = Number.isFinite(value) && value > 0 ? value : 0;
  switch (metric) {
    case "distancia":
      return formatDistance(v);
    case "altimetria":
      return `${Math.round(v)} m`;
    case "tempo":
      return formatDuration(v);
  }
}

/**
 * Início da janela do período (ISO), determinístico. `sempre` → null (sem
 * filtro). Regras documentadas (Req 5.3):
 * - semana: segunda-feira 00:00 do horário local do dispositivo.
 * - mes: dia 1 00:00 local.
 * - ano: 1º de janeiro 00:00 local.
 * O cliente passa este ISO à RPC, mantendo uma única regra de janela.
 */
export function periodStartIso(period: RankingPeriod, now: Date): string | null {
  if (period === "sempre") return null;
  const d = new Date(now.getTime());
  d.setHours(0, 0, 0, 0);
  if (period === "semana") {
    // getDay(): 0=domingo..6=sábado. Semana começa na segunda.
    const day = d.getDay();
    const diffToMonday = (day + 6) % 7; // domingo→6, segunda→0, terça→1...
    d.setDate(d.getDate() - diffToMonday);
  } else if (period === "mes") {
    d.setDate(1);
  } else if (period === "ano") {
    d.setMonth(0, 1);
  }
  return d.toISOString();
}

/** Rótulo i18n-key da métrica (a UI resolve via t()). */
export function rankingMetricKey(metric: RankingMetric): string {
  return `ranking.metric.${metric}`;
}
