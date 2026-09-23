-- Loja virtual — a campanha na Comunidade deve aparecer como o BANNER
-- estilizado (mesmo da prévia/Iniciar), não como um post comum. Portanto:
--  1) RLS de leitura pública passa a liberar campanhas ativas que aparecem no
--     Iniciar OU na Comunidade (para o feed montar o card).
--  2) admin_upsert_campaign NÃO cria mais community_posts genérico — o feed
--     renderiza o CampaignCard direto a partir da campanha.
-- Idempotente.

-- 1) Leitura pública: ativa E (show_on_start OU post_to_community).
drop policy if exists "partner_campaigns_select_public" on public.partner_campaigns;
create policy "partner_campaigns_select_public" on public.partner_campaigns
  for select using (status = 'active' and (show_on_start = true or post_to_community = true));

-- 2) RPC recriada sem criação de community_posts (o card é renderizado no feed).
drop function if exists public.admin_upsert_campaign(uuid, uuid, text, text, text, text, text, text, boolean, boolean, text, timestamptz, timestamptz, boolean, text, text);

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
  _ends_at timestamptz,
  _notify_users boolean,
  _theme text,
  _layout text
)
returns public.partner_campaigns
language plpgsql
security definer
set search_path = public
as $$
declare
  _row public.partner_campaigns;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'not authorized';
  end if;

  if _id is null then
    insert into public.partner_campaigns (
      partner_id, title, description, image_url, cta_label, cta_url, price,
      show_on_start, post_to_community, status, starts_at, ends_at, notify_users,
      theme, layout, created_by
    ) values (
      _partner_id, _title, _description, _image_url, _cta_label, _cta_url, _price,
      coalesce(_show_on_start, true), coalesce(_post_to_community, false),
      coalesce(_status, 'active'), _starts_at, _ends_at, coalesce(_notify_users, false),
      coalesce(_theme, 'forest'), coalesce(_layout, 'overlay'), auth.uid()
    )
    returning * into _row;
  else
    update public.partner_campaigns set
      partner_id = _partner_id, title = _title, description = _description,
      image_url = _image_url, cta_label = _cta_label, cta_url = _cta_url, price = _price,
      show_on_start = coalesce(_show_on_start, true),
      post_to_community = coalesce(_post_to_community, false),
      status = coalesce(_status, 'active'), starts_at = _starts_at, ends_at = _ends_at,
      notify_users = coalesce(_notify_users, false),
      theme = coalesce(_theme, 'forest'), layout = coalesce(_layout, 'overlay'),
      updated_at = now()
    where id = _id
    returning * into _row;
  end if;

  -- Broadcast no sininho (uma vez), quando a campanha está ativa.
  if _row.notify_users and _row.notified_at is null and _row.status = 'active' then
    insert into public.notifications (recipient_id, type, payload)
    select p.id, 'campaign',
      jsonb_build_object(
        'campaignId', _row.id, 'title', _row.title, 'imageUrl', _row.image_url,
        'ctaUrl', _row.cta_url, 'partnerId', _row.partner_id
      )
    from public.profiles p;
    update public.partner_campaigns set notified_at = now() where id = _row.id
    returning * into _row;
  end if;

  return _row;
end;
$$;

revoke all on function public.admin_upsert_campaign(uuid, uuid, text, text, text, text, text, text, boolean, boolean, text, timestamptz, timestamptz, boolean, text, text) from public;
grant execute on function public.admin_upsert_campaign(uuid, uuid, text, text, text, text, text, text, boolean, boolean, text, timestamptz, timestamptz, boolean, text, text) to authenticated;

-- 3) Limpa o post genérico já criado por campanhas existentes (o card assume o
--    lugar). Remove os community_posts vinculados e zera o vínculo.
delete from public.community_posts
  where id in (select community_post_id from public.partner_campaigns where community_post_id is not null);
update public.partner_campaigns set community_post_id = null where community_post_id is not null;
