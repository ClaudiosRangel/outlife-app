-- 20261116120000_ocultar-usuario.sql
-- Ocultar usuário do app (moderação admin) + datas de cadastro/último acesso.
--  1) Colunas profiles.is_hidden / hidden_at / last_seen_at.
--  2) Funções is_user_hidden / can_see_user.
--  3) RPCs admin_set_hidden, touch_last_seen, admin_user_dates.
--  4) Políticas RESTRICTIVE de SELECT (somente leitura; INSERT/UPDATE/DELETE
--     não são afetados). O próprio usuário e admins continuam vendo tudo.
--  5) RPCs/funções SECURITY DEFINER que agregam usuários passam a filtrar
--     por can_see_user (assinaturas e retornos mantidos).
-- Idempotente (IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS).

-- ============ 1) Colunas ============
alter table public.profiles
  add column if not exists is_hidden boolean not null default false,
  add column if not exists hidden_at timestamptz,
  add column if not exists last_seen_at timestamptz;

-- ============ 2) Funções de visibilidade ============
create or replace function public.is_user_hidden(_uid uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = _uid and p.is_hidden);
$$;

create or replace function public.can_see_user(_uid uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select _uid is null
      or not public.is_user_hidden(_uid)
      or _uid = auth.uid()
      or public.is_admin(auth.uid());
$$;

grant execute on function public.is_user_hidden(uuid) to authenticated, anon;
grant execute on function public.can_see_user(uuid) to authenticated, anon;

-- ============ 3) RPCs ============
-- Proteção: usuário comum não pode alterar is_hidden/hidden_at no próprio perfil.
-- (Corpo atual da função + as duas colunas novas. Admin e RPCs de admin passam.)
create or replace function public.protect_profile_trust_fields()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin(auth.uid()) then
    return new;
  end if;

  if current_setting('outlife.bypass_follow_counters', true) is distinct from 'true' then
    new.followers_count := old.followers_count;
    new.following_count := old.following_count;
  end if;

  new.is_verified := old.is_verified;
  new.rating := old.rating;
  new.reviews_count := old.reviews_count;
  new.level := old.level;
  new.progress_to_next_level := old.progress_to_next_level;
  new.role := old.role;
  new.status := old.status;
  new.is_hidden := old.is_hidden;
  new.hidden_at := old.hidden_at;
  -- Banimento também não pode ser desfeito pelo próprio usuário.
  new.is_banned := old.is_banned;
  new.banned_reason := old.banned_reason;
  new.banned_at := old.banned_at;
  return new;
end;
$$;

create or replace function public.admin_set_hidden(_user_id uuid, _hidden boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'Acesso negado'; end if;
  update public.profiles
     set is_hidden = _hidden,
         hidden_at = case when _hidden then now() else null end
   where id = _user_id;
end;
$$;
revoke all on function public.admin_set_hidden(uuid, boolean) from public, anon;
grant execute on function public.admin_set_hidden(uuid, boolean) to authenticated;

create or replace function public.touch_last_seen()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  update public.profiles
     set last_seen_at = now()
   where id = auth.uid()
     and (last_seen_at is null or last_seen_at < now() - interval '5 minutes');
end;
$$;
revoke all on function public.touch_last_seen() from public, anon;
grant execute on function public.touch_last_seen() to authenticated;

drop function if exists public.admin_user_dates(uuid[]);
create or replace function public.admin_user_dates(_user_ids uuid[])
returns table (
  id uuid,
  created_at timestamptz,
  last_seen_at timestamptz,
  last_sign_in_at timestamptz,
  is_hidden boolean
)
language sql stable security definer set search_path = public as $$
  select p.id, u.created_at, p.last_seen_at, u.last_sign_in_at, p.is_hidden
  from public.profiles p
  left join auth.users u on u.id = p.id
  where p.id = any(_user_ids)
    and public.is_admin(auth.uid());
$$;
revoke all on function public.admin_user_dates(uuid[]) from public, anon;
grant execute on function public.admin_user_dates(uuid[]) to authenticated;

-- ============ 4) Políticas RESTRICTIVE de SELECT ============
-- Só cria onde a tabela e a coluna existem. Várias colunas = AND (some se
-- qualquer lado for oculto).
do $$
declare
  r record;
  c text;
  _expr text;
begin
  for r in
    select * from (values
      ('profiles',                array['id']),
      ('community_posts',         array['author_id']),
      ('post_likes',              array['user_id']),
      ('post_comments',           array['author_id']),
      ('comment_likes',           array['user_id']),
      ('user_activities',         array['user_id']),
      ('user_checklists',         array['user_id']),
      ('user_destination_visits', array['user_id']),
      ('segment_efforts',         array['user_id']),
      ('segments',                array['created_by']),
      ('achievement_records',     array['user_id']),
      ('saved_destinations',      array['user_id']),
      ('user_league_divisions',   array['user_id']),
      ('events',                  array['created_by']),
      ('event_participants',      array['user_id']),
      ('event_questions',         array['author_id']),
      ('reviews',                 array['author_id']),
      ('destination_comments',    array['user_id']),
      ('user_friends',            array['requester_id', 'addressee_id']),
      ('direct_messages',         array['sender_id', 'recipient_id']),
      ('services',                array['partner_id']),
      ('favorite_partners',       array['user_id', 'partner_id']),
      ('partner_leads',           array['partner_id', 'user_id']),
      ('partner_campaigns',       array['partner_id']),
      ('partner_metric_daily',    array['partner_id']),
      ('coupons',                 array['partner_id'])
    ) as t(tbl, cols)
  loop
    if to_regclass('public.' || r.tbl) is null then
      raise notice 'tabela % inexistente, ignorada', r.tbl;
      continue;
    end if;
    _expr := null;
    foreach c in array r.cols loop
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = r.tbl and column_name = c
      ) then
        _expr := coalesce(_expr || ' and ', '') || format('public.can_see_user(%I)', c);
      else
        raise notice 'coluna %.% inexistente, ignorada', r.tbl, c;
      end if;
    end loop;
    if _expr is null then continue; end if;
    execute format('drop policy if exists hidden_users_restrictive on public.%I', r.tbl);
    execute format(
      'create policy hidden_users_restrictive on public.%I as restrictive for select to authenticated, anon using (%s)',
      r.tbl, _expr
    );
  end loop;

  -- Destinos: só somem os criados pelo usuário oculto que ainda NÃO foram
  -- aprovados (destino aprovado é conteúdo do app, permanece).
  if to_regclass('public.destinations') is not null
     and exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'destinations' and column_name = 'created_by')
     and exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'destinations' and column_name = 'status') then
    drop policy if exists hidden_users_restrictive on public.destinations;
    create policy hidden_users_restrictive on public.destinations
      as restrictive for select to authenticated, anon
      using (status::text = 'approved' or public.can_see_user(created_by));
  end if;
end $$;

-- ============ 5) RPCs SECURITY DEFINER que agregam usuários ============
-- Ranking global/seguidos (6 args).
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
      and public.can_see_user(ua.user_id)
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
    and public.can_see_user(p.id)
  order by
    case when _metric = 'tempo' then a.value end asc,
    case when _metric <> 'tempo' then a.value end desc,
    a.user_id asc
  limit greatest(1, least(coalesce(_limit, 50), 200));
$$;
grant execute on function public.fetch_activity_ranking(text, text, timestamptz, uuid, integer, text) to authenticated;

-- Sugestões de amizade.
CREATE OR REPLACE FUNCTION public.suggest_friends(_limit integer DEFAULT 20)
RETURNS TABLE (
  id uuid,
  full_name text,
  username text,
  avatar_url text,
  reason text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH
  related AS (
    SELECT addressee_id AS other FROM public.user_friends WHERE requester_id = _uid
    UNION
    SELECT requester_id AS other FROM public.user_friends WHERE addressee_id = _uid
  ),
  my_friends AS (
    SELECT addressee_id AS friend FROM public.user_friends
      WHERE requester_id = _uid AND status = 'accepted'
    UNION
    SELECT requester_id AS friend FROM public.user_friends
      WHERE addressee_id = _uid AND status = 'accepted'
  ),
  fof AS (
    SELECT DISTINCT
      CASE WHEN uf.requester_id = mf.friend THEN uf.addressee_id ELSE uf.requester_id END AS candidate,
      'friend_of_friend'::text AS reason
    FROM public.user_friends uf
    JOIN my_friends mf
      ON (uf.requester_id = mf.friend OR uf.addressee_id = mf.friend)
    WHERE uf.status = 'accepted'
  ),
  my_types AS (
    SELECT DISTINCT activity_type FROM public.user_activities
      WHERE user_id = _uid AND status = 'completed' AND activity_type IS NOT NULL
  ),
  common AS (
    SELECT DISTINCT ua.user_id AS candidate, 'common_activity'::text AS reason
    FROM public.user_activities ua
    JOIN my_types mt ON ua.activity_type = mt.activity_type
    WHERE ua.status = 'completed' AND ua.user_id <> _uid
  ),
  candidates AS (
    SELECT candidate, reason FROM fof
    UNION ALL
    SELECT candidate, reason FROM common
  ),
  ranked AS (
    SELECT candidate,
           MIN(CASE WHEN reason = 'friend_of_friend' THEN 0 ELSE 1 END) AS pri
    FROM candidates
    GROUP BY candidate
  )
  SELECT p.id,
         p.full_name,
         p.username,
         p.avatar_url,
         CASE WHEN r.pri = 0 THEN 'friend_of_friend' ELSE 'common_activity' END AS reason
  FROM ranked r
  JOIN public.profiles p ON p.id = r.candidate
  WHERE r.candidate <> _uid
    AND public.can_see_user(p.id)
    AND r.candidate NOT IN (SELECT other FROM related)
  ORDER BY r.pri ASC, p.full_name ASC NULLS LAST
  LIMIT GREATEST(1, LEAST(_limit, 50));
END;
$function$;
GRANT EXECUTE ON FUNCTION public.suggest_friends(integer) TO authenticated;

-- Liga semanal.
CREATE OR REPLACE FUNCTION public.fetch_league_standings(
  _activity_type text DEFAULT NULL,
  _limit integer DEFAULT 50
) RETURNS TABLE (
  o_user_id uuid,
  o_full_name text,
  o_username text,
  o_avatar_url text,
  o_points integer,
  o_division text,
  o_is_me boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _this_week date := public.league_week_start(current_date);
  _prev_week date := _this_week - 7;
  _my_div text;
  _atype text := coalesce(_activity_type, '');
BEGIN
  IF _uid IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.user_league_divisions (user_id, activity_type, division)
  VALUES (_uid, _atype, 'bronze')
  ON CONFLICT (user_id, activity_type) DO NOTHING;

  PERFORM public.process_league_rollover(_prev_week, _atype);

  SELECT uld.division INTO _my_div
  FROM public.user_league_divisions uld
  WHERE uld.user_id = _uid AND uld.activity_type = _atype;

  RETURN QUERY
  WITH week_pts AS (
    SELECT ua.user_id AS uid,
           SUM(public.league_points_expr(ua.distance_meters, ua.elevation_gain))::int AS pts
    FROM public.user_activities ua
    WHERE ua.status = 'completed'
      AND (ua.start_time AT TIME ZONE 'America/Sao_Paulo')::date >= _this_week
      AND (ua.start_time AT TIME ZONE 'America/Sao_Paulo')::date <  _this_week + 7
      AND (_atype = '' OR ua.activity_type = _atype)
    GROUP BY ua.user_id
  )
  SELECT p.id,
         p.full_name,
         p.username,
         p.avatar_url,
         coalesce(wp.pts, 0),
         uld.division,
         (p.id = _uid)
  FROM public.user_league_divisions uld
  JOIN public.profiles p ON p.id = uld.user_id
  LEFT JOIN week_pts wp ON wp.uid = uld.user_id
  WHERE uld.activity_type = _atype
    AND uld.division = _my_div
    AND public.can_see_user(p.id)
  ORDER BY coalesce(wp.pts, 0) DESC, p.id
  LIMIT greatest(1, least(coalesce(_limit, 50), 200));
END;
$$;
GRANT EXECUTE ON FUNCTION public.fetch_league_standings(text, integer) TO authenticated;

-- Ranking de segmento (KOM).
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
      and public.can_see_user(se.user_id)
    order by se.user_id, se.elapsed_seconds asc, se.achieved_at asc
  ),
  ranked as (
    select
      b.user_id, b.best_seconds, b.activity_id,
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
GRANT EXECUTE ON FUNCTION public.segment_ranking(uuid, int) TO authenticated;

create or replace function public.segment_leaderboard(_segment_id uuid, _limit int default 10)
returns table (
  user_id uuid,
  full_name text,
  avatar_url text,
  best_seconds int,
  achieved_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select b.user_id, pr.full_name, pr.avatar_url, b.best_seconds, b.achieved_at
  from (
    select distinct on (se.user_id)
      se.user_id,
      se.elapsed_seconds as best_seconds,
      se.achieved_at
    from public.segment_efforts se
    where se.segment_id = _segment_id
      and public.can_see_user(se.user_id)
    order by se.user_id, se.elapsed_seconds asc, se.achieved_at asc
  ) b
  join public.profiles pr on pr.id = b.user_id
  order by b.best_seconds asc
  limit greatest(1, least(_limit, 100));
$$;
grant execute on function public.segment_leaderboard(uuid, int) to anon, authenticated;

-- Amigos na trilha.
CREATE OR REPLACE FUNCTION public.fetch_friends_on_destination(
  _destination_id uuid,
  _radius_meters double precision DEFAULT 1500,
  _limit integer DEFAULT 30
) RETURNS TABLE (
  user_id uuid,
  full_name text,
  username text,
  avatar_url text,
  last_activity_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _dgeog geography;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;

  SELECT COALESCE(d.route_geog, d.geog) INTO _dgeog
  FROM public.destinations d
  WHERE d.id = _destination_id AND d.status = 'approved';
  IF _dgeog IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT p.id, p.full_name, p.username, p.avatar_url, MAX(ua.start_time) AS last_activity_at
  FROM public.user_activities ua
  JOIN public.profiles p ON p.id = ua.user_id
  WHERE ua.status = 'completed'
    AND ua.route IS NOT NULL
    AND public.can_see_user(p.id)
    AND ST_DWithin(ua.route, _dgeog, GREATEST(0, _radius_meters))
    AND ua.user_id IN (
      SELECT uf.addressee_id FROM public.user_friends uf
      WHERE uf.requester_id = _uid AND uf.status IN ('following', 'accepted')
    )
  GROUP BY p.id, p.full_name, p.username, p.avatar_url
  ORDER BY last_activity_at DESC
  LIMIT greatest(1, least(coalesce(_limit, 30), 100));
END;
$$;
GRANT EXECUTE ON FUNCTION public.fetch_friends_on_destination(uuid, double precision, integer) TO authenticated;

-- Comentários do destino.
CREATE OR REPLACE FUNCTION public.fetch_destination_comments(
  _destination_id uuid,
  _limit int DEFAULT 100
) RETURNS TABLE (
  id uuid,
  user_id uuid,
  full_name text,
  username text,
  avatar_url text,
  text text,
  created_at timestamptz,
  is_me boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id, c.user_id, p.full_name, p.username, p.avatar_url, c.text, c.created_at,
         (c.user_id = auth.uid())
  FROM public.destination_comments c
  JOIN public.profiles p ON p.id = c.user_id
  WHERE c.destination_id = _destination_id
    AND public.can_see_user(c.user_id)
  ORDER BY c.created_at DESC
  LIMIT greatest(1, least(_limit, 200));
$$;
GRANT EXECUTE ON FUNCTION public.fetch_destination_comments(uuid, int) TO anon, authenticated;

-- Quem já esteve no destino.
CREATE OR REPLACE FUNCTION public.fetch_destination_visitors(
  _destination_id uuid,
  _limit int DEFAULT 30
) RETURNS TABLE (
  user_id uuid,
  full_name text,
  username text,
  avatar_url text,
  visited_at timestamptz,
  is_friend boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT v.user_id, p.full_name, p.username, p.avatar_url, v.visited_at,
    EXISTS (
      SELECT 1 FROM public.user_friends uf
      WHERE uf.status IN ('accepted','following')
        AND ((uf.requester_id = auth.uid() AND uf.addressee_id = v.user_id)
          OR (uf.addressee_id = auth.uid() AND uf.requester_id = v.user_id))
    ) AS is_friend
  FROM public.user_destination_visits v
  JOIN public.profiles p ON p.id = v.user_id
  WHERE v.destination_id = _destination_id
    AND public.can_see_user(v.user_id)
  ORDER BY is_friend DESC, v.visited_at DESC
  LIMIT greatest(1, least(_limit, 100));
$$;
GRANT EXECUTE ON FUNCTION public.fetch_destination_visitors(uuid, int) TO anon, authenticated;

-- Avatares de quem curtiu.
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
      and public.can_see_user(pl.user_id)
  ) pl
  join public.profiles pr on pr.id = pl.user_id
  where pl.rn <= greatest(1, least(_limit, 10))
  order by pl.post_id, pl.created_at desc;
$$;
grant execute on function public.post_like_avatars(uuid[], int) to anon, authenticated;

-- Conversas (chat): some a conversa com interlocutor oculto.
CREATE OR REPLACE FUNCTION public.list_conversations()
RETURNS TABLE (
  other_id uuid,
  full_name text,
  username text,
  avatar_url text,
  last_text text,
  last_at timestamptz,
  unread integer
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  RETURN QUERY
  WITH msgs AS (
    SELECT
      CASE WHEN dm.sender_id = _uid THEN dm.recipient_id ELSE dm.sender_id END AS other,
      dm.text, dm.created_at, dm.read_at, dm.recipient_id
    FROM public.direct_messages dm
    WHERE dm.sender_id = _uid OR dm.recipient_id = _uid
  ),
  ranked AS (
    SELECT other, text, created_at,
           ROW_NUMBER() OVER (PARTITION BY other ORDER BY created_at DESC) AS rn
    FROM msgs
  ),
  unread AS (
    SELECT other, COUNT(*)::int AS cnt
    FROM msgs
    WHERE recipient_id = _uid AND read_at IS NULL
    GROUP BY other
  )
  SELECT r.other, p.full_name, p.username, p.avatar_url, r.text, r.created_at,
         COALESCE(u.cnt, 0)
  FROM ranked r
  JOIN public.profiles p ON p.id = r.other
  LEFT JOIN unread u ON u.other = r.other
  WHERE r.rn = 1
    AND public.can_see_user(r.other)
  ORDER BY r.created_at DESC;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.list_conversations() TO authenticated;
