-- Troféus de segmento do usuário (spec conquistas de segmento).
-- Para cada segmento em que o usuário tem esforço, calcula a posição do seu
-- MELHOR tempo no ranking geral (1 = Rei/KOM). Retorna só quando está no
-- top _max_rank (padrão 10). Inclui a activity_id do esforço campeão do
-- usuário para abrir a atividade ao clicar no troféu. Idempotente.

drop function if exists public.my_segment_trophies(int);

create or replace function public.my_segment_trophies(_max_rank int default 10)
returns table (
  segment_id uuid,
  segment_name text,
  activity_type text,
  distance_meters numeric,
  best_seconds int,
  activity_id uuid,
  achieved_at timestamptz,
  rank int,
  total_athletes int
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select auth.uid() as uid
  ),
  -- Melhor esforço de CADA atleta em CADA segmento.
  best_per_user as (
    select distinct on (se.segment_id, se.user_id)
      se.segment_id,
      se.user_id,
      se.elapsed_seconds as best_seconds,
      se.activity_id,
      se.achieved_at
    from public.segment_efforts se
    order by se.segment_id, se.user_id, se.elapsed_seconds asc, se.achieved_at asc
  ),
  ranked as (
    select
      b.*,
      rank() over (partition by b.segment_id order by b.best_seconds asc) as rnk,
      count(*) over (partition by b.segment_id) as total
    from best_per_user b
  )
  select
    r.segment_id,
    s.name as segment_name,
    s.activity_type,
    s.distance_meters,
    r.best_seconds,
    r.activity_id,
    r.achieved_at,
    r.rnk::int as rank,
    r.total::int as total_athletes
  from ranked r
  join me on me.uid = r.user_id
  join public.segments s on s.id = r.segment_id
  where r.rnk <= greatest(1, least(_max_rank, 50))
  order by r.rnk asc, r.best_seconds asc;
$$;

revoke all on function public.my_segment_trophies(int) from public;
grant execute on function public.my_segment_trophies(int) to authenticated;
