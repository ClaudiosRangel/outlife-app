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
