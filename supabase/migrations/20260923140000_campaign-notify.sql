-- Loja virtual — item 2: opção de NOTIFICAR TODOS os usuários no sininho ao
-- criar/ativar uma campanha (configurável na área administrativa). Idempotente.

-- 1) Colunas de controle da notificação broadcast.
alter table public.partner_campaigns
  add column if not exists notify_users boolean not null default false;
alter table public.partner_campaigns
  add column if not exists notified_at timestamptz;

-- 2) RPC de upsert recriada com o parâmetro _notify_users. Quando marcado e
--    ainda não notificado (notified_at null), insere uma Notification tipo
--    'campaign' para TODOS os perfis (broadcast), uma única vez, e marca
--    notified_at. SECURITY DEFINER protegido por is_admin.
drop function if exists public.admin_upsert_campaign(uuid, uuid, text, text, text, text, text, text, boolean, boolean, text, timestamptz, timestamptz);
drop function if exists public.admin_upsert_campaign(uuid, uuid, text, text, text, text, text, text, boolean, boolean, text, timestamptz, timestamptz, boolean);

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
  _notify_users boolean
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
      show_on_start, post_to_community, status, starts_at, ends_at, notify_users, created_by
    ) values (
      _partner_id, _title, _description, _image_url, _cta_label, _cta_url, _price,
      coalesce(_show_on_start, true), coalesce(_post_to_community, false),
      coalesce(_status, 'active'), _starts_at, _ends_at, coalesce(_notify_users, false), auth.uid()
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
      notify_users = coalesce(_notify_users, false),
      updated_at = now()
    where id = _id
    returning * into _row;
  end if;

  -- Post na comunidade (uma vez).
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

  -- Broadcast no sininho (uma vez), quando a campanha está ativa.
  if _row.notify_users and _row.notified_at is null and _row.status = 'active' then
    insert into public.notifications (recipient_id, type, payload)
    select p.id, 'campaign',
      jsonb_build_object(
        'campaignId', _row.id,
        'title', _row.title,
        'imageUrl', _row.image_url,
        'ctaUrl', _row.cta_url,
        'partnerId', _row.partner_id
      )
    from public.profiles p;
    update public.partner_campaigns set notified_at = now() where id = _row.id
    returning * into _row;
  end if;

  return _row;
end;
$$;

revoke all on function public.admin_upsert_campaign(uuid, uuid, text, text, text, text, text, text, boolean, boolean, text, timestamptz, timestamptz, boolean) from public;
grant execute on function public.admin_upsert_campaign(uuid, uuid, text, text, text, text, text, text, boolean, boolean, text, timestamptz, timestamptz, boolean) to authenticated;
