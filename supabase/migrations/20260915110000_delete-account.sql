-- Exclusão de conta in-app (LGPD + exigência das lojas).
-- RPC SECURITY DEFINER que remove/anonimiza os dados do titular autenticado.
--
-- Estratégia (baseada no schema real):
--  - A maioria das tabelas de usuário tem FK -> profiles.id ON DELETE CASCADE,
--    então deletar o profile limpa o conteúdo pessoal em cascata.
--  - Tabelas por user_id SEM FK para profiles são limpas manualmente.
--  - event_questions.answered_by é NO ACTION -> anonimizar (SET NULL) antes.
--  - profiles.id NÃO tem FK para auth.users -> deletar auth.users
--    explicitamente para invalidar o login.
--
-- Idempotente: CREATE OR REPLACE; DROP defensivo antes.

drop function if exists public.delete_my_account();

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  _uid uuid := auth.uid();
begin
  if _uid is null then
    raise exception 'Não autenticado';
  end if;

  -- Anonimiza referências de curadoria/histórico que não são cascade
  -- (preserva integridade sem reidentificar o titular).
  update public.event_questions set answered_by = null where answered_by = _uid;

  -- Tabelas por user_id sem FK para profiles (limpeza explícita).
  delete from public.user_activities where user_id = _uid;
  delete from public.user_checklists where user_id = _uid;
  delete from public.user_achievement_stats where user_id = _uid;
  delete from public.user_level_stats where user_id = _uid;
  delete from public.user_roles where user_id = _uid;
  delete from public.rpc_rate_limit_log where user_id = _uid;

  -- Deleta o profile -> dispara os cascades (posts, comentários, likes,
  -- mensagens, notificações, favoritos, reviews, eventos, tokens push, etc.).
  delete from public.profiles where id = _uid;

  -- Invalida o login (profiles.id não tem FK para auth.users).
  delete from auth.users where id = _uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
