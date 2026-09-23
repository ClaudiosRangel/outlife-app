-- Checkout (Pix/cartão) + Cupons — estrutura de dados e RPCs, agnóstica de
-- gateway (PSP). Pronta para plugar o provedor de pagamento depois via Edge
-- Function de webhook. Idempotente.
--
-- NADA aqui processa pagamento real: o pedido nasce 'pending'. Quem confirma
-- é o webhook do PSP (Edge Function `payment-webhook`, criada em supabase/
-- functions/), que marca o pedido 'paid'. Enquanto não houver PSP configurado,
-- o pedido fica 'pending' e o app mostra "aguardando pagamento".

-- ============ 1) CUPONS ============
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  -- 'percent' (0-100) ou 'fixed' (centavos).
  discount_type text not null default 'percent',
  discount_value numeric not null default 0,
  -- Escopo opcional: cupom de um parceiro específico.
  partner_id uuid references public.profiles(id) on delete cascade,
  -- Limites.
  min_amount_cents int not null default 0,
  max_redemptions int,            -- null = ilimitado
  redemptions_count int not null default 0,
  per_user_limit int not null default 1,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

do $$ begin
  alter table public.coupons add constraint coupons_discount_type_check
    check (discount_type in ('percent', 'fixed'));
exception when duplicate_object then null; end $$;

create unique index if not exists idx_coupons_code_unique on public.coupons (lower(code));

alter table public.coupons enable row level security;
-- Leitura pública dos cupons ativos (para validar no checkout).
drop policy if exists "coupons_select_public" on public.coupons;
create policy "coupons_select_public" on public.coupons for select using (active = true);

-- ============ 2) PEDIDOS ============
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  campaign_id uuid references public.partner_campaigns(id) on delete set null,
  partner_id uuid references public.profiles(id) on delete set null,
  title text not null,                 -- snapshot do que foi comprado
  -- Valores em CENTAVOS (evita float).
  amount_cents int not null default 0,       -- valor base
  discount_cents int not null default 0,     -- desconto do cupom
  total_cents int not null default 0,        -- amount - discount
  coupon_id uuid references public.coupons(id) on delete set null,
  coupon_code text,
  -- 'pix' | 'card'
  payment_method text,
  -- 'pending' | 'paid' | 'failed' | 'canceled' | 'refunded'
  status text not null default 'pending',
  -- Dados do PSP (preenchidos pela Edge Function ao criar/confirmar cobrança).
  psp_provider text,                   -- 'mercadopago' | 'asaas' | ...
  psp_charge_id text,                  -- id da cobrança no PSP
  pix_qr_code text,                    -- copia-e-cola do Pix
  pix_qr_image text,                   -- imagem (base64/url) do QR
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  alter table public.orders add constraint orders_status_check
    check (status in ('pending', 'paid', 'failed', 'canceled', 'refunded'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.orders add constraint orders_method_check
    check (payment_method is null or payment_method in ('pix', 'card'));
exception when duplicate_object then null; end $$;

create index if not exists idx_orders_user on public.orders(user_id, created_at desc);
create index if not exists idx_orders_status on public.orders(status);

alter table public.orders enable row level security;
-- O usuário vê/gerencia apenas os próprios pedidos.
drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own" on public.orders for select using (user_id = auth.uid());

-- ============ 3) USOS DE CUPOM ============
create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_coupon_redemptions_coupon on public.coupon_redemptions(coupon_id);
create index if not exists idx_coupon_redemptions_user on public.coupon_redemptions(coupon_id, user_id);
alter table public.coupon_redemptions enable row level security;
drop policy if exists "coupon_redemptions_select_own" on public.coupon_redemptions;
create policy "coupon_redemptions_select_own" on public.coupon_redemptions for select using (user_id = auth.uid());

-- ============ 4) FUNÇÕES ============

-- Preço da campanha em centavos, derivado do texto `price` (ex.: "R$ 499",
-- "499,90"). Retorna 0 quando não dá para interpretar (campanha sem preço).
create or replace function public.campaign_price_cents(_price text)
returns int
language plpgsql
immutable
as $$
declare
  cleaned text;
  val numeric;
begin
  if _price is null then return 0; end if;
  -- Remove tudo que não é dígito, vírgula ou ponto.
  cleaned := regexp_replace(_price, '[^0-9,\.]', '', 'g');
  if cleaned = '' then return 0; end if;
  -- Normaliza: se tem vírgula, trata como separador decimal BR.
  if position(',' in cleaned) > 0 then
    cleaned := replace(cleaned, '.', '');   -- remove milhar
    cleaned := replace(cleaned, ',', '.');  -- vírgula -> ponto decimal
  end if;
  begin
    val := cleaned::numeric;
  exception when others then
    return 0;
  end;
  return round(val * 100)::int;
end;
$$;

-- Valida um cupom para o usuário atual e um valor base (centavos). Retorna
-- o desconto aplicável em centavos e uma mensagem. NÃO consome o cupom.
drop function if exists public.validate_coupon(text, int, uuid);
create or replace function public.validate_coupon(_code text, _amount_cents int, _partner_id uuid)
returns table (valid boolean, discount_cents int, message text, coupon_id uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _c public.coupons;
  _uses int;
  _disc int;
begin
  select * into _c from public.coupons where lower(code) = lower(_code) and active = true limit 1;
  if _c.id is null then
    return query select false, 0, 'Cupom inválido.', null::uuid; return;
  end if;
  if _c.starts_at is not null and now() < _c.starts_at then
    return query select false, 0, 'Cupom ainda não válido.', null::uuid; return;
  end if;
  if _c.ends_at is not null and now() > _c.ends_at then
    return query select false, 0, 'Cupom expirado.', null::uuid; return;
  end if;
  if _c.partner_id is not null and _partner_id is not null and _c.partner_id <> _partner_id then
    return query select false, 0, 'Cupom não vale para este parceiro.', null::uuid; return;
  end if;
  if _amount_cents < _c.min_amount_cents then
    return query select false, 0, 'Valor mínimo não atingido.', null::uuid; return;
  end if;
  if _c.max_redemptions is not null and _c.redemptions_count >= _c.max_redemptions then
    return query select false, 0, 'Cupom esgotado.', null::uuid; return;
  end if;
  select count(*) into _uses from public.coupon_redemptions where coupon_id = _c.id and user_id = auth.uid();
  if _uses >= _c.per_user_limit then
    return query select false, 0, 'Você já usou este cupom.', null::uuid; return;
  end if;
  -- Calcula desconto.
  if _c.discount_type = 'percent' then
    _disc := round(_amount_cents * least(greatest(_c.discount_value, 0), 100) / 100.0)::int;
  else
    _disc := least(_c.discount_value::int, _amount_cents);
  end if;
  return query select true, _disc, 'Cupom aplicado.', _c.id;
end;
$$;

-- Cria um pedido para o usuário atual a partir de uma campanha, opcionalmente
-- com cupom e método. Nasce 'pending'. A cobrança real (Pix/cartão) é criada
-- pela Edge Function do PSP a partir deste pedido. Idempotência simples: não
-- reaproveita pedidos (cada checkout cria um novo pending).
drop function if exists public.create_order(uuid, text, text);
create or replace function public.create_order(_campaign_id uuid, _coupon_code text, _payment_method text)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  _camp public.partner_campaigns;
  _amount int;
  _disc int := 0;
  _coupon_id uuid;
  _order public.orders;
  _v record;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into _camp from public.partner_campaigns where id = _campaign_id;
  if _camp.id is null then raise exception 'campaign not found'; end if;

  _amount := public.campaign_price_cents(_camp.price);

  if _coupon_code is not null and length(trim(_coupon_code)) > 0 then
    select * into _v from public.validate_coupon(_coupon_code, _amount, _camp.partner_id);
    if _v.valid then
      _disc := _v.discount_cents;
      _coupon_id := _v.coupon_id;
    end if;
  end if;

  insert into public.orders (
    user_id, campaign_id, partner_id, title, amount_cents, discount_cents,
    total_cents, coupon_id, coupon_code, payment_method, status
  ) values (
    auth.uid(), _camp.id, _camp.partner_id, _camp.title, _amount, _disc,
    greatest(_amount - _disc, 0), _coupon_id,
    case when _coupon_id is not null then _coupon_code else null end,
    _payment_method, 'pending'
  ) returning * into _order;

  return _order;
end;
$$;

-- Meus pedidos.
drop function if exists public.my_orders();
create or replace function public.my_orders()
returns setof public.orders
language sql
stable
security definer
set search_path = public
as $$
  select * from public.orders where user_id = auth.uid() order by created_at desc;
$$;

revoke all on function public.validate_coupon(text, int, uuid) from public;
grant execute on function public.validate_coupon(text, int, uuid) to authenticated;
revoke all on function public.create_order(uuid, text, text) from public;
grant execute on function public.create_order(uuid, text, text) to authenticated;
revoke all on function public.my_orders() from public;
grant execute on function public.my_orders() to authenticated;
grant execute on function public.campaign_price_cents(text) to authenticated, anon;
