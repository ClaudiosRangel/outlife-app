-- Moderação administrativa por usuário (spec — itens admin 6/7).
-- RPCs SECURITY DEFINER protegidas por is_admin: excluir post/evento de
-- qualquer usuário, enviar aviso (notification) e banir/desbanir.
-- Idempotente.

-- Coluna de banimento (reaproveita profile_status quando possível; usamos um
-- booleano explícito + motivo para clareza e para não depender do enum).
alter table public.profiles add column if not exists is_banned boolean not null default false;
alter table public.profiles add column if not exists banned_reason text;
alter table public.profiles add column if not exists banned_at timestamptz;

-- Excluir uma publicação (community_posts) como admin.
create or replace function public.admin_delete_post(_post_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'Acesso negado'; end if;
  delete from public.community_posts where id = _post_id;
end;
$$;

-- Excluir um evento como admin.
create or replace function public.admin_delete_event(_event_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'Acesso negado'; end if;
  delete from public.events where id = _event_id;
end;
$$;

-- Enviar um aviso (notification) a um usuário como admin.
create or replace function public.admin_send_warning(_user_id uuid, _message text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'Acesso negado'; end if;
  if _message is null or length(trim(_message)) = 0 then raise exception 'Mensagem obrigatória'; end if;
  insert into public.notifications (recipient_id, type, payload, created_at)
  values (
    _user_id,
    'admin_warning',
    jsonb_build_object('message', _message, 'from', 'admin'),
    now()
  );
end;
$$;

-- Banir / desbanir usuário como admin.
create or replace function public.admin_set_ban(_user_id uuid, _banned boolean, _reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'Acesso negado'; end if;
  update public.profiles
    set is_banned = _banned,
        banned_reason = case when _banned then _reason else null end,
        banned_at = case when _banned then now() else null end
  where id = _user_id;
end;
$$;

-- Listar publicações de um usuário (admin) — para a tela de moderação.
drop function if exists public.admin_user_posts(uuid, int);
create or replace function public.admin_user_posts(_user_id uuid, _limit int default 50)
returns table (id uuid, text text, image_url text, created_at timestamptz)
language sql security definer set search_path = public as $$
  select p.id, p.text, p.image_url, p.created_at
  from public.community_posts p
  where p.author_id = _user_id and public.is_admin(auth.uid())
  order by p.created_at desc
  limit greatest(1, least(_limit, 200));
$$;

-- Listar eventos de um usuário (admin).
drop function if exists public.admin_user_events(uuid, int);
create or replace function public.admin_user_events(_user_id uuid, _limit int default 50)
returns table (id uuid, title text, event_date timestamptz, status text)
language sql security definer set search_path = public as $$
  select e.id, e.title, e.event_date, e.status
  from public.events e
  where e.created_by = _user_id and public.is_admin(auth.uid())
  order by e.event_date desc
  limit greatest(1, least(_limit, 200));
$$;

revoke all on function public.admin_delete_post(uuid) from public, anon;
revoke all on function public.admin_delete_event(uuid) from public, anon;
revoke all on function public.admin_send_warning(uuid, text) from public, anon;
revoke all on function public.admin_set_ban(uuid, boolean, text) from public, anon;
revoke all on function public.admin_user_posts(uuid, int) from public, anon;
revoke all on function public.admin_user_events(uuid, int) from public, anon;
grant execute on function public.admin_delete_post(uuid) to authenticated;
grant execute on function public.admin_delete_event(uuid) to authenticated;
grant execute on function public.admin_send_warning(uuid, text) to authenticated;
grant execute on function public.admin_set_ban(uuid, boolean, text) to authenticated;
grant execute on function public.admin_user_posts(uuid, int) to authenticated;
grant execute on function public.admin_user_events(uuid, int) to authenticated;
