-- Ranking por TIPO de atividade (Rodada 2): estende fetch_activity_ranking com
-- um filtro opcional _activity_type (NULL = todos os tipos, comportamento
-- atual). Recria a função (DROP + CREATE) porque a assinatura ganha um novo
-- parâmetro. O frontend é o único chamador e é atualizado no mesmo commit.
-- Idempotente.

drop function if exists public.fetch_activity_ranking(text, text, timestamptz, uuid, integer);
drop function if exists public.fetch_activity_ranking(text, text, timestamptz, uuid, integer, text);

create or replace function public.fetch_activity_ranking(
  _metric text,
  _scope text default 'global',
  _since timestamptz default null,
  _destination_id uuid default null,
  _limit integer default 50,
  _activity_type text default null
) returns table (
  user_id uuid,
  full_name text,
  username text,
  avatar_url text,
  value numeric
)
language sql
security definer
set search_path = public
as $$
  with scoped as (
    select ua.*
    from public.user_activities ua
    where ua.status = 'completed'
      and (_since is null or ua.start_time >= _since)
      and (_destination_id is null or ua.destination_id = _destination_id)
      and (_activity_type is null or ua.activity_type = _activity_type)
      and (
        _scope <> 'seguidos'
        or ua.user_id = auth.uid()
        or ua.user_id in (
          select uf.addressee_id
          from public.user_friends uf
          where uf.requester_id = auth.uid()
            and uf.status in ('following', 'accepted')
        )
      )
  ),
  agg as (
    select
      s.user_id,
      case
        when _metric = 'distancia'  then coalesce(sum(s.distance_meters), 0)
        when _metric = 'altimetria' then coalesce(sum(s.elevation_gain), 0)
        when _metric = 'tempo'      then coalesce(min(nullif(s.duration_seconds, 0)), 0)
        else 0
      end as value
    from scoped s
    group by s.user_id
  )
  select
    a.user_id,
    p.full_name,
    p.username,
    p.avatar_url,
    a.value
  from agg a
  join public.profiles p on p.id = a.user_id
  where a.value > 0
  order by
    case when _metric = 'tempo' then a.value end asc,
    case when _metric <> 'tempo' then a.value end desc,
    a.user_id asc
  limit greatest(1, least(coalesce(_limit, 50), 200));
$$;

grant execute on function public.fetch_activity_ranking(text, text, timestamptz, uuid, integer, text) to authenticated;
