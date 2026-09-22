-- Aceite obrigatório de Termos de Uso / Política de Privacidade.
-- Histórico auditável em legal_acceptances (nunca sobrescreve) +
-- denormalização em profiles.accepted_legal_version para o gate rápido.
-- Idempotente.

create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  doc_version text not null,
  accepted_at timestamptz not null default now(),
  app_platform text,
  user_agent text
);

create index if not exists idx_legal_acceptances_user
  on public.legal_acceptances(user_id);

alter table public.profiles
  add column if not exists accepted_legal_version text;

-- RLS: o dono lê e insere o próprio aceite; sem update/delete pelo usuário.
alter table public.legal_acceptances enable row level security;

drop policy if exists "legal_acceptances_select_own" on public.legal_acceptances;
create policy "legal_acceptances_select_own"
  on public.legal_acceptances for select
  using (user_id = auth.uid());

drop policy if exists "legal_acceptances_insert_own" on public.legal_acceptances;
create policy "legal_acceptances_insert_own"
  on public.legal_acceptances for insert
  with check (user_id = auth.uid());

-- RPC de aceite: insere no histórico e atualiza a denormalização.
drop function if exists public.accept_legal_terms(text, text, text);

create or replace function public.accept_legal_terms(
  _doc_version text,
  _platform text,
  _user_agent text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
begin
  if _uid is null then
    raise exception 'Não autenticado';
  end if;
  if _doc_version is null or length(trim(_doc_version)) = 0 then
    raise exception 'Versão do documento é obrigatória';
  end if;

  insert into public.legal_acceptances (user_id, doc_version, app_platform, user_agent)
  values (_uid, _doc_version, _platform, _user_agent);

  update public.profiles set accepted_legal_version = _doc_version where id = _uid;
end;
$$;

revoke all on function public.accept_legal_terms(text, text, text) from public, anon;
grant execute on function public.accept_legal_terms(text, text, text) to authenticated;
