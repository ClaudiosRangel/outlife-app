// API das Ligas semanais + Badges (Bloco 2). Leitura cross-usuário via RPCs
// SECURITY DEFINER (a RLS de user_activities não permite leitura cruzada).

import { supabase } from "@/integrations/supabase/client";

export type LeagueDivision = "bronze" | "prata" | "ouro" | "diamante";

export type LeagueStanding = {
  userId: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  points: number;
  division: LeagueDivision;
  isMe: boolean;
};

export type BadgeItem = {
  code: string;
  earned: boolean;
  /** 0..1 rumo ao critério. */
  progress: number;
};

/**
 * Standings da liga da minha divisão na semana corrente, para um tipo de
 * atividade (null = liga geral). Dispara o rollover idempotente da semana
 * anterior no backend. Retorna lista ordenada por pontos (desc).
 */
export async function fetchLeagueStandings(activityType: string | null): Promise<LeagueStanding[]> {
  const { data, error } = await supabase.rpc("fetch_league_standings" as never, {
    _activity_type: activityType,
    _limit: 100,
  } as never);
  if (error) throw error;
  // A RPC devolve colunas com prefixo o_ (para evitar ambiguidade com colunas
  // de tabela dentro da função — ver migration 20260927110000).
  const rows = (data as unknown as Array<{
    o_user_id: string;
    o_full_name: string | null;
    o_username: string | null;
    o_avatar_url: string | null;
    o_points: number;
    o_division: LeagueDivision;
    o_is_me: boolean;
  }>) ?? [];
  return rows.map((r) => ({
    userId: r.o_user_id,
    fullName: r.o_full_name,
    username: r.o_username,
    avatarUrl: r.o_avatar_url,
    points: Number(r.o_points ?? 0),
    division: r.o_division,
    isMe: !!r.o_is_me,
  }));
}

/** Catálogo de badges do usuário (obtidas x a obter, com progresso). */
export async function fetchMyBadges(): Promise<BadgeItem[]> {
  const { data, error } = await supabase.rpc("list_my_badges" as never, {} as never);
  if (error) throw error;
  const rows = (data as unknown as Array<{ code: string; earned: boolean; progress: number }>) ?? [];
  return rows.map((r) => ({ code: r.code, earned: !!r.earned, progress: Number(r.progress ?? 0) }));
}


// KOM/troféus por segmento (velocidade média) — item 4 complementar.
export type SegmentRankRow = {
  userId: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  bestSeconds: number;
  avgSpeedKmh: number;
  activityId: string | null;
  rank: number;
  isMe: boolean;
};

export async function fetchSegmentRanking(segmentId: string, limit = 10): Promise<SegmentRankRow[]> {
  const { data, error } = await supabase.rpc("segment_ranking" as never, {
    _segment_id: segmentId,
    _limit: limit,
  } as never);
  if (error) throw error;
  const rows = (data as unknown as Array<{
    o_user_id: string; o_full_name: string | null; o_username: string | null;
    o_avatar_url: string | null; o_best_seconds: number; o_avg_speed_kmh: number;
    o_activity_id: string | null; o_rank: number; o_is_me: boolean;
  }>) ?? [];
  return rows.map((r) => ({
    userId: r.o_user_id,
    fullName: r.o_full_name,
    username: r.o_username,
    avatarUrl: r.o_avatar_url,
    bestSeconds: Number(r.o_best_seconds ?? 0),
    avgSpeedKmh: Number(r.o_avg_speed_kmh ?? 0),
    activityId: r.o_activity_id,
    rank: Number(r.o_rank ?? 0),
    isMe: !!r.o_is_me,
  }));
}

// Selo de KOM/troféu de segmento no CARD da comunidade (estilo Strava). Para
// uma lista de atividades, retorna o melhor troféu de cada uma (menor rank =
// melhor; 1 = KOM/QOM), com o nome do segmento, a velocidade média e o total
// de troféus daquela atividade. Busca em lote (evita N+1 no feed).
export type ActivitySegmentTrophy = {
  activityId: string;
  bestRank: number;
  segmentId: string;
  segmentName: string | null;
  avgSpeedKmh: number;
  trophyCount: number;
};

export async function fetchActivitySegmentAchievements(
  activityIds: string[],
  maxRank = 10,
): Promise<Map<string, ActivitySegmentTrophy>> {
  const ids = activityIds.filter(Boolean);
  const map = new Map<string, ActivitySegmentTrophy>();
  if (ids.length === 0) return map;
  const { data, error } = await supabase.rpc("activity_segment_achievements" as never, {
    _activity_ids: ids,
    _max_rank: maxRank,
  } as never);
  if (error) throw error;
  const rows = (data as unknown as Array<{
    o_activity_id: string; o_best_rank: number; o_best_segment_id: string;
    o_best_segment_name: string | null; o_best_avg_speed_kmh: number; o_trophy_count: number;
  }>) ?? [];
  for (const r of rows) {
    map.set(r.o_activity_id, {
      activityId: r.o_activity_id,
      bestRank: Number(r.o_best_rank ?? 0),
      segmentId: r.o_best_segment_id,
      segmentName: r.o_best_segment_name,
      avgSpeedKmh: Number(r.o_best_avg_speed_kmh ?? 0),
      trophyCount: Number(r.o_trophy_count ?? 0),
    });
  }
  return map;
}
