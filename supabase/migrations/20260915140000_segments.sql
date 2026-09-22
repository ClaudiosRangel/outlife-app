-- Segmentos nativos (spec segmentos). Tabelas segments + segment_efforts,
-- RLS (leitura pública, escrita do dono) e RPC de ranking. Idempotente.

create table if not exists public.segments (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles(id) on delete set null,
  name text not null,
  activity_type text,
  distance_meters numeric not null default 0,
  polyline jsonb not null,
  start_lat numeric,
  start_lng numeric,
  end_lat numeric,
  end_lng numeric,
  min_lat numeric,
  max_lat numeric,
  min_lng numeric,
  max_lng numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.segment_efforts (
  id uuid primary key default gen_random_uuid(),
  segment_id uuid not null references public.segments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  activity_id uuid references public.user_activities(id) on delete cascade,
  elapsed_seconds int not null,
  achieved_at timestamptz not null default now()
);

create index if not exists idx_segment_efforts_segment on public.segment_efforts(segment_id);
create index if not exists idx_segment_efforts_user on public.segment_efforts(user_id);
create index if not exists idx_segments_bbox on public.segments(min_lat, max_lat, min_lng, max_lng);

alter table public.segments enable row level security;
alter table public.segment_efforts enable row level security;

-- Leitura pública.
drop policy if exists "segments_select_all" on public.segments;
create policy "segments_select_all" on public.segments for select using (true);

drop policy if exists "segment_efforts_select_all" on public.segment_efforts;
create policy "segment_efforts_select_all" on public.segment_efforts for select using (true);

-- Escrita restrita ao dono.
drop policy if exists "segments_insert_own" on public.segments;
create policy "segments_insert_own" on public.segments for insert
  with check (created_by = auth.uid());

drop policy if exists "segments_update_own" on public.segments;
create policy "segments_update_own" on public.segments for update
  using (created_by = auth.uid());

drop policy if exists "segments_delete_own" on public.segments;
create policy "segments_delete_own" on public.segments for delete
  using (created_by = auth.uid());

drop policy if exists "segment_efforts_insert_own" on public.segment_efforts;
create policy "segment_efforts_insert_own" on public.segment_efforts for insert
  with check (user_id = auth.uid());

drop policy if exists "segment_efforts_delete_own" on public.segment_efforts;
create policy "segment_efforts_delete_own" on public.segment_efforts for delete
  using (user_id = auth.uid());

-- Ranking: melhor tempo por usuário, asc, top _limit. Junta profiles.
drop function if exists public.segment_leaderboard(uuid, int);

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
    order by se.user_id, se.elapsed_seconds asc, se.achieved_at asc
  ) b
  join public.profiles pr on pr.id = b.user_id
  order by b.best_seconds asc
  limit greatest(1, least(_limit, 100));
$$;

revoke all on function public.segment_leaderboard(uuid, int) from public;
grant execute on function public.segment_leaderboard(uuid, int) to anon, authenticated;
