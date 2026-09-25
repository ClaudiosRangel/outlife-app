-- Streak de atividade (Rodada 3 / design): dias CONSECUTIVOS (até hoje ou
-- ontem) com pelo menos uma atividade concluída pelo usuário. Alimenta a tela
-- comemorativa de "atividade concluída" e (futuramente) o perfil/Home.
-- Idempotente. SECURITY DEFINER porque a RLS de user_activities não permite
-- ler entre usuários — aqui a função lê SÓ do próprio auth.uid().

create or replace function public.my_activity_streak()
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _streak int := 0;
  _cursor date;
  _has boolean;
begin
  if auth.uid() is null then return 0; end if;

  -- Dias distintos (fuso Brasília) com atividade concluída do usuário.
  -- A streak conta a partir de hoje; se não houve atividade hoje mas houve
  -- ontem, começa em ontem (não "quebra" só porque o dia de hoje ainda não teve
  -- atividade). Se não houve nem hoje nem ontem, streak = 0.
  select exists (
    select 1 from public.user_activities ua
    where ua.user_id = auth.uid()
      and ua.status = 'completed'
      and (ua.start_time at time zone 'America/Sao_Paulo')::date = current_date
  ) into _has;

  if _has then
    _cursor := current_date;
  else
    select exists (
      select 1 from public.user_activities ua
      where ua.user_id = auth.uid()
        and ua.status = 'completed'
        and (ua.start_time at time zone 'America/Sao_Paulo')::date = current_date - 1
    ) into _has;
    if _has then
      _cursor := current_date - 1;
    else
      return 0;
    end if;
  end if;

  -- Anda para trás enquanto cada dia tiver atividade.
  loop
    select exists (
      select 1 from public.user_activities ua
      where ua.user_id = auth.uid()
        and ua.status = 'completed'
        and (ua.start_time at time zone 'America/Sao_Paulo')::date = _cursor
    ) into _has;
    exit when not _has;
    _streak := _streak + 1;
    _cursor := _cursor - 1;
    -- Salvaguarda: não varre mais que ~5 anos.
    exit when _streak > 1830;
  end loop;

  return _streak;
end;
$$;

revoke all on function public.my_activity_streak() from public;
grant execute on function public.my_activity_streak() to authenticated;
