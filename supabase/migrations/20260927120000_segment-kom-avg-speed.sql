-- 20260927120000_segment-kom-avg-speed.sql
-- KOM + troféus (1º-10º) por segmento baseados na VELOCIDADE MÉDIA (estilo
-- Strava). Como a distância do segmento é FIXA, ranquear por maior velocidade
-- média (distance/elapsed) é equivalente a ranquear por menor tempo — mas aqui
-- expomos a velocidade média explicitamente e a posição/pódio para a UI.
-- Idempotente.

-- Ranking do segmento: melhor esforço de cada atleta, ordenado por VELOCIDADE
-- MÉDIA desc (= menor tempo, já que a distância é a mesma). Retorna top _limit
-- com nome/avatar, tempo, velocidade média (km/h) e posição. 1 = KOM/QOM.
CREATE OR REPLACE FUNCTION public.segment_ranking(
  _segment_id uuid,
  _limit int DEFAULT 10
) RETURNS TABLE (
  o_user_id uuid,
  o_full_name text,
  o_username text,
  o_avatar_url text,
  o_best_seconds int,
  o_avg_speed_kmh numeric,
  o_activity_id uuid,
  o_rank int,
  o_is_me boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  with seg as (
    select id, distance_meters from public.segments where id = _segment_id
  ),
  best_per_user as (
    select distinct on (se.user_id)
      se.user_id, se.elapsed_seconds as best_seconds, se.activity_id
    from public.segment_efforts se
    where se.segment_id = _segment_id and se.elapsed_seconds > 0
    order by se.user_id, se.elapsed_seconds asc, se.achieved_at asc
  ),
  ranked as (
    select
      b.user_id, b.best_seconds, b.activity_id,
      -- velocidade média km/h = (dist_m / tempo_s) * 3.6
      round((seg.distance_meters / nullif(b.best_seconds, 0)) * 3.6, 1) as avg_speed_kmh,
      rank() over (order by b.best_seconds asc) as rnk
    from best_per_user b cross join seg
  )
  select
    r.user_id,
    p.full_name,
    p.username,
    p.avatar_url,
    r.best_seconds,
    r.avg_speed_kmh,
    r.activity_id,
    r.rnk::int,
    (r.user_id = auth.uid())
  from ranked r
  join public.profiles p on p.id = r.user_id
  where r.rnk <= greatest(1, least(_limit, 50))
  order by r.rnk asc;
$$;
REVOKE ALL ON FUNCTION public.segment_ranking(uuid, int) FROM public;
GRANT EXECUTE ON FUNCTION public.segment_ranking(uuid, int) TO authenticated;

-- Recria my_segment_trophies acrescentando a velocidade média do esforço
-- campeão do usuário (para a tela de troféus mostrar "X km/h" como o Strava).
DROP FUNCTION IF EXISTS public.my_segment_trophies(int);
CREATE FUNCTION public.my_segment_trophies(_max_rank int default 10)
returns table (
  segment_id uuid,
  segment_name text,
  activity_type text,
  distance_meters numeric,
  best_seconds int,
  avg_speed_kmh numeric,
  activity_id uuid,
  achieved_at timestamptz,
  rank int,
  total_athletes int
)
language sql stable security definer set search_path = public
as $$
  with me as (select auth.uid() as uid),
  best_per_user as (
    select distinct on (se.segment_id, se.user_id)
      se.segment_id, se.user_id, se.elapsed_seconds as best_seconds,
      se.activity_id, se.achieved_at
    from public.segment_efforts se
    where se.elapsed_seconds > 0
    order by se.segment_id, se.user_id, se.elapsed_seconds asc, se.achieved_at asc
  ),
  ranked as (
    select b.*,
      rank() over (partition by b.segment_id order by b.best_seconds asc) as rnk,
      count(*) over (partition by b.segment_id) as total
    from best_per_user b
  )
  select
    r.segment_id, s.name, s.activity_type, s.distance_meters,
    r.best_seconds,
    round((s.distance_meters / nullif(r.best_seconds,0)) * 3.6, 1) as avg_speed_kmh,
    r.activity_id, r.achieved_at, r.rnk::int, r.total::int
  from ranked r
  join me on me.uid = r.user_id
  join public.segments s on s.id = r.segment_id
  where r.rnk <= greatest(1, least(_max_rank, 50))
  order by r.rnk asc, r.best_seconds asc;
$$;
REVOKE ALL ON FUNCTION public.my_segment_trophies(int) FROM public;
GRANT EXECUTE ON FUNCTION public.my_segment_trophies(int) TO authenticated;
