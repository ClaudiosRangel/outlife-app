-- Visibilidade de segmento (item 2): ao criar, o segmento pode ser
-- 'public' (todos), 'friends' (só amigos aceitos do criador) ou 'private'
-- (só o criador). Default 'public' para preservar o comportamento atual dos
-- segmentos já existentes. Idempotente.

-- 1) Coluna visibility com CHECK (segue o padrão TEXT+CHECK do projeto).
alter table public.segments
  add column if not exists visibility text not null default 'public';

do $$
begin
  alter table public.segments
    add constraint segments_visibility_check
    check (visibility in ('public', 'friends', 'private'));
exception
  when duplicate_object then null; -- constraint já existe
end $$;

-- 2) RLS de leitura respeitando a visibilidade.
--    - public: qualquer um vê.
--    - o próprio criador sempre vê o seu (qualquer visibilidade).
--    - friends: vê quem tem amizade 'accepted' (qualquer direção) com o criador.
drop policy if exists "segments_select_all" on public.segments;
drop policy if exists "segments_select_visibility" on public.segments;
create policy "segments_select_visibility" on public.segments for select
  using (
    visibility = 'public'
    or created_by = auth.uid()
    or (
      visibility = 'friends'
      and exists (
        select 1 from public.user_friends uf
        where uf.status = 'accepted'
          and (
            (uf.requester_id = auth.uid() and uf.addressee_id = segments.created_by)
            or (uf.addressee_id = auth.uid() and uf.requester_id = segments.created_by)
          )
      )
    )
  );

-- 3) Índice por visibilidade (filtragem de listagem pública).
create index if not exists idx_segments_visibility on public.segments(visibility);
