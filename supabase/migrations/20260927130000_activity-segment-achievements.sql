-- 20260927130000_activity-segment-achievements.sql
-- Selo de KOM/troféu por segmento no CARD da comunidade (estilo Strava).
-- Para uma lista de atividades, retorna o MELHOR troféu de segmento que cada
-- atividade rendeu ao seu autor: o menor rank alcançado (1 = KOM/QOM) entre os
-- segmentos cujo esforço campeão do atleta veio daquela atividade, com o total
-- de troféus (rank <= _max_rank) e o nome do segmento do melhor.
-- Idempotente. Leitura cross-usuário via SECURITY DEFINER (posts são públicos;
-- expõe apenas rank/nome do segmento, não dados sensíveis).

CREATE OR REPLACE FUNCTION public.activity_segment_achievements(
  _activity_ids uuid[],
  _max_rank int DEFAULT 10
) RETURNS TABLE (
  o_activity_id uuid,
  o_best_rank int,
  o_best_segment_id uuid,
  o_best_segment_name text,
  o_best_avg_speed_kmh numeric,
  o_trophy_count int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  with target as (
    select a.id as activity_id, a.user_id
    from public.user_activities a
    where a.id = any(_activity_ids)
  ),
  -- melhor esforço de cada atleta em cada segmento (o que define o ranking)
  best_per_user as (
    select distinct on (se.segment_id, se.user_id)
      se.segment_id, se.user_id,
      se.elapsed_seconds as best_seconds,
      se.activity_id
    from public.segment_efforts se
    where se.elapsed_seconds > 0
    order by se.segment_id, se.user_id, se.elapsed_seconds asc, se.achieved_at asc
  ),
  ranked as (
    select b.*,
      rank() over (partition by b.segment_id order by b.best_seconds asc) as rnk
    from best_per_user b
  ),
  -- troféus que a ATIVIDADE-alvo rendeu: o esforço campeão do atleta naquele
  -- segmento foi gravado NESTA atividade e ficou dentro do top _max_rank.
  trophies as (
    select
      t.activity_id,
      r.segment_id,
      r.rnk,
      s.name as segment_name,
      round((s.distance_meters / nullif(r.best_seconds, 0)) * 3.6, 1) as avg_speed_kmh
    from target t
    join ranked r on r.user_id = t.user_id and r.activity_id = t.activity_id
    join public.segments s on s.id = r.segment_id
    where r.rnk <= greatest(1, least(_max_rank, 50))
  ),
  agg as (
    select
      activity_id,
      count(*)::int as trophy_count,
      min(rnk)::int as best_rank
    from trophies
    group by activity_id
  )
  select
    a.activity_id,
    a.best_rank,
    tb.segment_id,
    tb.segment_name,
    tb.avg_speed_kmh,
    a.trophy_count
  from agg a
  -- pega o segmento do melhor rank (desempata pelo nome)
  join lateral (
    select tt.segment_id, tt.segment_name, tt.avg_speed_kmh
    from trophies tt
    where tt.activity_id = a.activity_id and tt.rnk = a.best_rank
    order by tt.segment_name asc
    limit 1
  ) tb on true;
$$;
REVOKE ALL ON FUNCTION public.activity_segment_achievements(uuid[], int) FROM public;
GRANT EXECUTE ON FUNCTION public.activity_segment_achievements(uuid[], int) TO authenticated;
