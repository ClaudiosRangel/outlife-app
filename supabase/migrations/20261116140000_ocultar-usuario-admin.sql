-- 20261116140000_ocultar-usuario-admin.sql
-- Usuário oculto não aparece em NENHUM lugar do app, nem para admin.
-- 1) can_see_user deixa de liberar admin (só o próprio usuário continua vendo a si mesmo).
-- 2) A tela de moderação passa a listar usuários por RPC security definer
--    (único caminho que enxerga os ocultos, para poder reexibi-los).
-- Idempotente.

create or replace function public.can_see_user(_uid uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select _uid is null
      or not public.is_user_hidden(_uid)
      or _uid = auth.uid();
$$;
grant execute on function public.can_see_user(uuid) to authenticated, anon;

drop function if exists public.admin_list_users(text, int);
create or replace function public.admin_list_users(_query text default null, _limit int default 200)
returns table (id uuid, full_name text, username text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.username, p.avatar_url
  from public.profiles p
  where public.is_admin(auth.uid())
    and (
      _query is null or _query = ''
      or p.full_name ilike '%' || _query || '%'
      or p.username ilike '%' || _query || '%'
    )
  order by p.full_name asc nulls last
  limit greatest(1, least(coalesce(_limit, 200), 500));
$$;
revoke all on function public.admin_list_users(text, int) from public, anon;
grant execute on function public.admin_list_users(text, int) to authenticated;
