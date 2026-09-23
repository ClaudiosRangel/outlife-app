-- Cupons — RPC de incremento (usada pelo webhook) + CRUD admin. Idempotente.

-- Incrementa o contador de redenções de um cupom (chamado pela Edge Function
-- payment-webhook via service_role; SECURITY DEFINER para permitir a escrita).
create or replace function public.increment_coupon_redemptions(_coupon_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.coupons set redemptions_count = redemptions_count + 1 where id = _coupon_id;
$$;

-- ADMIN: lista todos os cupons.
drop function if exists public.admin_list_coupons();
create or replace function public.admin_list_coupons()
returns setof public.coupons
language sql
stable
security definer
set search_path = public
as $$
  select * from public.coupons where public.is_admin(auth.uid()) order by created_at desc;
$$;

-- ADMIN: cria/atualiza cupom.
drop function if exists public.admin_upsert_coupon(uuid, text, text, numeric, uuid, int, int, int, timestamptz, timestamptz, boolean);
create or replace function public.admin_upsert_coupon(
  _id uuid,
  _code text,
  _discount_type text,
  _discount_value numeric,
  _partner_id uuid,
  _min_amount_cents int,
  _max_redemptions int,
  _per_user_limit int,
  _starts_at timestamptz,
  _ends_at timestamptz,
  _active boolean
)
returns public.coupons
language plpgsql
security definer
set search_path = public
as $$
declare _row public.coupons;
begin
  if not public.is_admin(auth.uid()) then raise exception 'not authorized'; end if;
  if _id is null then
    insert into public.coupons (
      code, discount_type, discount_value, partner_id, min_amount_cents,
      max_redemptions, per_user_limit, starts_at, ends_at, active, created_by
    ) values (
      _code, coalesce(_discount_type,'percent'), coalesce(_discount_value,0), _partner_id,
      coalesce(_min_amount_cents,0), _max_redemptions, coalesce(_per_user_limit,1),
      _starts_at, _ends_at, coalesce(_active,true), auth.uid()
    ) returning * into _row;
  else
    update public.coupons set
      code = _code, discount_type = coalesce(_discount_type,'percent'),
      discount_value = coalesce(_discount_value,0), partner_id = _partner_id,
      min_amount_cents = coalesce(_min_amount_cents,0), max_redemptions = _max_redemptions,
      per_user_limit = coalesce(_per_user_limit,1), starts_at = _starts_at, ends_at = _ends_at,
      active = coalesce(_active,true)
    where id = _id returning * into _row;
  end if;
  return _row;
end;
$$;

-- ADMIN: exclui cupom.
drop function if exists public.admin_delete_coupon(uuid);
create or replace function public.admin_delete_coupon(_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'not authorized'; end if;
  delete from public.coupons where id = _id;
end;
$$;

revoke all on function public.increment_coupon_redemptions(uuid) from public;
grant execute on function public.increment_coupon_redemptions(uuid) to authenticated;
revoke all on function public.admin_list_coupons() from public;
grant execute on function public.admin_list_coupons() to authenticated;
revoke all on function public.admin_upsert_coupon(uuid, text, text, numeric, uuid, int, int, int, timestamptz, timestamptz, boolean) from public;
grant execute on function public.admin_upsert_coupon(uuid, text, text, numeric, uuid, int, int, int, timestamptz, timestamptz, boolean) to authenticated;
revoke all on function public.admin_delete_coupon(uuid) from public;
grant execute on function public.admin_delete_coupon(uuid) to authenticated;
