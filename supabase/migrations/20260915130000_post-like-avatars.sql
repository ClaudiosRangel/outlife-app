-- Avatares de quem curtiu, por post, em lote (spec comunidade-card-strava).
-- Evita N+1 no feed: uma única chamada para todos os posts visíveis.
-- Retorna até _limit avatares por post (os mais recentes). Idempotente.

drop function if exists public.post_like_avatars(uuid[], int);

create or replace function public.post_like_avatars(_post_ids uuid[], _limit int default 3)
returns table (
  post_id uuid,
  user_id uuid,
  full_name text,
  avatar_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select pl.post_id, pl.user_id, pr.full_name, pr.avatar_url
  from (
    select
      pl.post_id,
      pl.user_id,
      pl.created_at,
      row_number() over (partition by pl.post_id order by pl.created_at desc) as rn
    from public.post_likes pl
    where pl.post_id = any(_post_ids)
  ) pl
  join public.profiles pr on pr.id = pl.user_id
  where pl.rn <= greatest(1, least(_limit, 10))
  order by pl.post_id, pl.created_at desc;
$$;

revoke all on function public.post_like_avatars(uuid[], int) from public;
grant execute on function public.post_like_avatars(uuid[], int) to anon, authenticated;
