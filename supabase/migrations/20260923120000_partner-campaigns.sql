-- Loja virtual dos parceiros (frente #8). Campanhas de parceiro criadas pela
-- área administrativa: propaganda/imagem que aparece na tela Iniciar e,
-- opcionalmente, um post na comunidade. Idempotente.

-- 1) Tabela de campanhas.
create table if not exists public.partner_campaigns (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  image_url text,
  cta_label text,             -- rótulo do botão (ex.: "Ver oferta")
  cta_url text,               -- link externo opcional (loja/whatsapp)
  price text,                 -- preço/observação livre (ex.: "R$ 199")
  show_on_start boolean not null default true,   -- aparece na tela Iniciar
  post_to_community boolean not null default false, -- gera post na comunidade
  community_post_id uuid references public.community_posts(id) on delete set null,
  status text not null default 'active',         -- active | paused
  starts_at timestamptz,      -- período de veiculação (opcional)
  ends_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  alter table public.partner_campaigns
    add constraint partner_campaigns_status_check check (status in ('active', 'paused'));
exception when duplicate_object then null;
end $$;

create index if not exists idx_partner_campaigns_start
  on public.partner_campaigns(show_on_start, status);
create index if not exists idx_partner_campaigns_partner
  on public.partner_campaigns(partner_id);

alter table public.partner_campaigns enable row level security;

-- 2) Leitura pública das campanhas ATIVAS que aparecem no Iniciar
--    (o filtro de período é aplicado na query/RPC). Admin lê tudo via RPC
--    SECURITY DEFINER.
drop policy if exists "partner_campaigns_select_public" on public.partner_campaigns;
create policy "partner_campaigns_select_public" on public.partner_campaigns
  for select using (status = 'active' and show_on_start = true);

-- Escrita só por admin (via RPC SECURITY DEFINER abaixo); sem policy de
-- insert/update/delete direta para usuário comum.

-- 3) is_admin helper já existe (usado na moderação). RPCs de campanha:

-- Lista TODAS as campanhas (admin) — ignora RLS.
drop function if exists public.admin_list_campaigns();
create or replace function public.admin_list_campaigns()
returns setof public.partner_campaigns
language sql
stable
security definer
set search_path = public
as $$
  select * from public.partner_campaigns
  where public.is_admin(auth.uid())
  order by created_at desc;
$$;

-- Cria/atualiza uma campanha (admin). Se _id nulo, cria; senão atualiza.
-- Quando post_to_community = true e ainda não há post vinculado, cria um
-- Community_Post (categoria 'outro') em nome do parceiro e vincula.
drop function if exists public.admin_upsert_campaign(uuid, uuid, text, text, text, text, text, text, boolean, boolean, text, timestamptz, timestamptz);
create or replace function public.admin_upsert_campaign(
  _id uuid,
  _partner_id uuid,
  _title text,
  _description text,
  _image_url text,
  _cta_label text,
  _cta_url text,
  _price text,
  _show_on_start boolean,
  _post_to_community boolean,
  _status text,
  _starts_at timestamptz,
  _ends_at timestamptz
)
returns public.partner_campaigns
language plpgsql
security definer
set search_path = public
as $$
declare
  _row public.partner_campaigns;
  _post_id uuid;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'not authorized';
  end if;

  if _id is null then
    insert into public.partner_campaigns (
      partner_id, title, description, image_url, cta_label, cta_url, price,
      show_on_start, post_to_community, status, starts_at, ends_at, created_by
    ) values (
      _partner_id, _title, _description, _image_url, _cta_label, _cta_url, _price,
      coalesce(_show_on_start, true), coalesce(_post_to_community, false),
      coalesce(_status, 'active'), _starts_at, _ends_at, auth.uid()
    )
    returning * into _row;
  else
    update public.partner_campaigns set
      partner_id = _partner_id,
      title = _title,
      description = _description,
      image_url = _image_url,
      cta_label = _cta_label,
      cta_url = _cta_url,
      price = _price,
      show_on_start = coalesce(_show_on_start, true),
      post_to_community = coalesce(_post_to_community, false),
      status = coalesce(_status, 'active'),
      starts_at = _starts_at,
      ends_at = _ends_at,
      updated_at = now()
    where id = _id
    returning * into _row;
  end if;

  -- Gera post na comunidade quando pedido e ainda não existe vínculo.
  if _row.post_to_community and _row.community_post_id is null then
    insert into public.community_posts (author_id, text, place, category, image_url)
    values (
      coalesce(_row.partner_id, auth.uid()),
      coalesce(_row.title, '') || case when _row.description is not null then E'\n' || _row.description else '' end,
      null, 'outro', _row.image_url
    )
    returning id into _post_id;

    update public.partner_campaigns set community_post_id = _post_id where id = _row.id
    returning * into _row;
  end if;

  return _row;
end;
$$;

-- Exclui campanha (admin). Também remove o post vinculado, se houver.
drop function if exists public.admin_delete_campaign(uuid);
create or replace function public.admin_delete_campaign(_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _post_id uuid;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'not authorized';
  end if;
  select community_post_id into _post_id from public.partner_campaigns where id = _id;
  delete from public.partner_campaigns where id = _id;
  if _post_id is not null then
    delete from public.community_posts where id = _post_id;
  end if;
end;
$$;

revoke all on function public.admin_list_campaigns() from public;
grant execute on function public.admin_list_campaigns() to authenticated;
revoke all on function public.admin_upsert_campaign(uuid, uuid, text, text, text, text, text, text, boolean, boolean, text, timestamptz, timestamptz) from public;
grant execute on function public.admin_upsert_campaign(uuid, uuid, text, text, text, text, text, text, boolean, boolean, text, timestamptz, timestamptz) to authenticated;
revoke all on function public.admin_delete_campaign(uuid) from public;
grant execute on function public.admin_delete_campaign(uuid) to authenticated;
