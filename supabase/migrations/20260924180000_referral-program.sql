-- Programa de indicação (frente WhatsApp PRO + indicação). Cada usuário tem um
-- código; quem se cadastra por um link/código de indicação vincula-se ao
-- indicador; ao confirmar a indicação, o INDICADOR ganha um cupom de desconto
-- (% definido na administração) válido em qualquer loja virtual. Idempotente.

-- 1) Colunas em profiles: código próprio + quem indicou.
alter table public.profiles add column if not exists referral_code text;
alter table public.profiles add column if not exists referred_by uuid references public.profiles(id) on delete set null;
create unique index if not exists idx_profiles_referral_code on public.profiles (referral_code) where referral_code is not null;

-- Gerador de código curto único (alfabeto sem ambíguos 0/O, 1/I/L).
create or replace function public.gen_referral_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  _alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  _code text;
  _i int;
  _try int := 0;
begin
  loop
    _code := '';
    for _i in 1..6 loop
      _code := _code || substr(_alphabet, 1 + floor(random() * length(_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where referral_code = _code);
    _try := _try + 1;
    if _try > 50 then
      _code := _code || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4);
      exit;
    end if;
  end loop;
  return _code;
end;
$$;

-- Backfill: um código único por linha, para quem ainda não tem.
do $$
declare _r record;
begin
  for _r in select id from public.profiles where referral_code is null loop
    update public.profiles set referral_code = public.gen_referral_code() where id = _r.id;
  end loop;
end $$;

-- 2) Tabela de indicações.
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',  -- pending | confirmed | rewarded
  coupon_id uuid references public.coupons(id) on delete set null,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unique (referred_id)  -- cada usuário só é indicado uma vez
);
create index if not exists idx_referrals_referrer on public.referrals(referrer_id);

do $$ begin
  alter table public.referrals add constraint referrals_status_check
    check (status in ('pending', 'confirmed', 'rewarded'));
exception when duplicate_object then null; end $$;

alter table public.referrals enable row level security;
drop policy if exists "referrals_select_own" on public.referrals;
create policy "referrals_select_own" on public.referrals for select
  using (referrer_id = auth.uid() or referred_id = auth.uid());

-- 3) Config do programa (tabela app_content genérica key/value, prefixo
--    referral.). referral.enabled ('true'/'false'),
--    referral.discount_percent ('15'), referral.coupon_days ('60').
--    Defaults inseridos se ausentes (não sobrescreve edição do admin).
insert into public.app_content (key, value) values
  ('referral.enabled', 'true'),
  ('referral.discount_percent', '15'),
  ('referral.coupon_days', '60')
on conflict (key) do nothing;

-- 4) Meu código de indicação (garante que existe e retorna).
create or replace function public.my_referral_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare _code text;
begin
  select referral_code into _code from public.profiles where id = auth.uid();
  if _code is null then
    _code := public.gen_referral_code();
    update public.profiles set referral_code = _code where id = auth.uid();
  end if;
  return _code;
end;
$$;

-- 5) Aplica uma indicação para o usuário atual (chamado logo após o cadastro),
--    a partir do código do indicador. Cria a linha 'pending' e vincula
--    profiles.referred_by. Não pode indicar a si mesmo nem ser indicado 2x.
create or replace function public.apply_referral(_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  _referrer uuid;
begin
  if auth.uid() is null or _code is null or length(trim(_code)) = 0 then return false; end if;
  select id into _referrer from public.profiles where upper(referral_code) = upper(trim(_code)) limit 1;
  if _referrer is null or _referrer = auth.uid() then return false; end if;
  -- Já indicado antes? não sobrescreve.
  if exists (select 1 from public.referrals where referred_id = auth.uid()) then return false; end if;
  update public.profiles set referred_by = _referrer where id = auth.uid() and referred_by is null;
  insert into public.referrals (referrer_id, referred_id, status)
    values (_referrer, auth.uid(), 'pending')
    on conflict (referred_id) do nothing;
  return true;
end;
$$;

-- 6) Confirma a indicação do usuário atual e RECOMPENSA o indicador com um
--    cupom (% da config). Chamado quando a indicação "conta" (ex.: cadastro
--    concluído / primeira ação relevante). Idempotente (só recompensa 1x).
create or replace function public.confirm_referral()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _ref public.referrals;
  _enabled text;
  _pct numeric;
  _days int;
  _code text;
  _coupon_id uuid;
begin
  if auth.uid() is null then return; end if;
  select * into _ref from public.referrals where referred_id = auth.uid() and status = 'pending' limit 1;
  if _ref.id is null then return; end if;

  select value into _enabled from public.app_content where key = 'referral.enabled';
  if coalesce(_enabled, 'true') <> 'true' then
    update public.referrals set status = 'confirmed', confirmed_at = now() where id = _ref.id;
    return;
  end if;

  select coalesce(value, '15')::numeric into _pct from public.app_content where key = 'referral.discount_percent';
  select coalesce(value, '60')::int into _days from public.app_content where key = 'referral.coupon_days';

  -- Cria cupom pessoal do INDICADOR (código único), % da config, validade.
  _code := 'IND-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.coupons (
    code, discount_type, discount_value, per_user_limit, max_redemptions,
    starts_at, ends_at, active, created_by
  ) values (
    _code, 'percent', _pct, 1, 1, now(), now() + (_days || ' days')::interval, true, _ref.referrer_id
  ) returning id into _coupon_id;

  update public.referrals
    set status = 'rewarded', confirmed_at = now(), coupon_id = _coupon_id
    where id = _ref.id;

  -- Notifica o indicador no sininho.
  insert into public.notifications (recipient_id, type, payload)
  values (_ref.referrer_id, 'referral_reward',
    jsonb_build_object('couponCode', _code, 'percent', _pct));
end;
$$;

-- 7) Meus dados de indicação (código, quantos indiquei, quantos recompensados).
create or replace function public.my_referral_stats()
returns table (code text, total int, rewarded int)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select referral_code from public.profiles where id = auth.uid()),
    (select count(*)::int from public.referrals where referrer_id = auth.uid()),
    (select count(*)::int from public.referrals where referrer_id = auth.uid() and status = 'rewarded');
$$;

revoke all on function public.my_referral_code() from public;
grant execute on function public.my_referral_code() to authenticated;
revoke all on function public.apply_referral(text) from public;
grant execute on function public.apply_referral(text) to authenticated;
revoke all on function public.confirm_referral() from public;
grant execute on function public.confirm_referral() to authenticated;
revoke all on function public.my_referral_stats() from public;
grant execute on function public.my_referral_stats() to authenticated;
