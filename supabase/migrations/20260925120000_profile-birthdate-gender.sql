-- Idade mínima 13+ (exigência das lojas / age gate) + dados demográficos
-- básicos: data de nascimento e gênero no perfil. Idempotente.
--
-- Ambos nullable para não quebrar perfis existentes; a tela "Complete seu
-- Perfil" (pós-cadastro) preenche e bloqueia menores de 13 anos ANTES de
-- concluir. O dono atualiza esses campos pela policy normal de UPDATE do
-- profile (o trigger protect_profile_trust_fields NÃO cobre estes campos).

alter table public.profiles add column if not exists birth_date date;
alter table public.profiles add column if not exists gender text;

-- Gênero: valores conhecidos (masculino/feminino/outro/prefiro não dizer) ou
-- NULL. CHECK idempotente.
do $$ begin
  alter table public.profiles add constraint profiles_gender_check
    check (gender is null or gender in ('male', 'female', 'other', 'undisclosed'));
exception when duplicate_object then null; end $$;

-- Função pura de idade em anos a partir de uma data (reuso: validação/segmentação).
create or replace function public.age_years(_birth date)
returns int
language sql
immutable
as $$
  select case
    when _birth is null then null
    else date_part('year', age(current_date, _birth))::int
  end;
$$;

grant execute on function public.age_years(date) to anon, authenticated;
