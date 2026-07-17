-- Sincroniza profiles.followers_count/following_count com o Post_Follow
-- (linhas `user_friends.status = 'following'`, ver migration
-- 20260716090100_user-friends-following-status.sql).
--
-- Contexto: ao seguir/deixar de seguir um autor na comunidade
-- (toggleAuthorFollow em src/lib/api.ts), nenhuma coluna de contagem em
-- `profiles` era atualizada -- os números "Seguidores"/"Seguindo" exibidos
-- em /perfil sempre mostravam 0, mesmo após seguir alguém com sucesso.
--
-- `followers_count`/`following_count` são campos protegidos pelo trigger
-- `protect_profile_trust_fields` (migration 20260522193933), que reverte
-- qualquer UPDATE feito por quem não é admin. A correção segue o mesmo
-- padrão de bypass sinalizado já usado por `outlife.bypass_post_counters`
-- (migration 20260716090000): um novo sinalizador de sessão
-- `outlife.bypass_follow_counters`, ligado apenas pela função
-- `sync_follow_counts` abaixo, autorizando exclusivamente essa função a
-- alterar essas duas colunas.

-- ============ 1) protect_profile_trust_fields (estendida) ============
CREATE OR REPLACE FUNCTION public.protect_profile_trust_fields()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF current_setting('outlife.bypass_follow_counters', true) IS DISTINCT FROM 'true' THEN
    NEW.followers_count := OLD.followers_count;
    NEW.following_count := OLD.following_count;
  END IF;

  NEW.is_verified := OLD.is_verified;
  NEW.rating := OLD.rating;
  NEW.reviews_count := OLD.reviews_count;
  NEW.level := OLD.level;
  NEW.progress_to_next_level := OLD.progress_to_next_level;
  NEW.role := OLD.role;
  NEW.status := OLD.status;
  RETURN NEW;
END;
$$;

-- ============ 2) sync_follow_counts ============
-- AFTER INSERT: alguém começou a seguir (`status = 'following'`) --
-- incrementa followers_count de quem foi seguido (addressee_id) e
-- following_count de quem seguiu (requester_id).
-- AFTER DELETE: alguém deixou de seguir -- decrementa os dois (nunca abaixo
-- de zero, mesma defesa de GREATEST(..., 0) já usada em toggle_post_like).
-- Ignora outros status (pending/accepted/blocked) de propósito: esses
-- representam Friendship (Requirement 3), não Post_Follow, e não fazem
-- parte deste contador.
CREATE OR REPLACE FUNCTION public.sync_follow_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('outlife.bypass_follow_counters', 'true', true);

  IF TG_OP = 'INSERT' AND NEW.status = 'following' THEN
    UPDATE public.profiles SET followers_count = COALESCE(followers_count, 0) + 1 WHERE id = NEW.addressee_id;
    UPDATE public.profiles SET following_count = COALESCE(following_count, 0) + 1 WHERE id = NEW.requester_id;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'following' THEN
    UPDATE public.profiles SET followers_count = GREATEST(COALESCE(followers_count, 0) - 1, 0) WHERE id = OLD.addressee_id;
    UPDATE public.profiles SET following_count = GREATEST(COALESCE(following_count, 0) - 1, 0) WHERE id = OLD.requester_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_follow_counts ON public.user_friends;
CREATE TRIGGER trg_sync_follow_counts
  AFTER INSERT OR DELETE ON public.user_friends
  FOR EACH ROW EXECUTE FUNCTION public.sync_follow_counts();

-- ============ 3) Backfill dos contadores já existentes ============
-- Recalcula followers_count/following_count de todos os perfis a partir das
-- linhas `following` já existentes hoje (a coluna nunca foi incrementada
-- antes desta migration, então qualquer follow feito anteriormente estava
-- "invisível" nos contadores). `PERFORM` só é válido dentro de um bloco
-- PL/pgSQL, então o sinalizador de bypass é ligado via `SELECT
-- set_config(...)` (equivalente, fora de uma função) antes dos dois UPDATE.
SELECT set_config('outlife.bypass_follow_counters', 'true', true);

UPDATE public.profiles p
SET followers_count = COALESCE((
  SELECT count(*) FROM public.user_friends uf
  WHERE uf.addressee_id = p.id AND uf.status = 'following'
), 0);

UPDATE public.profiles p
SET following_count = COALESCE((
  SELECT count(*) FROM public.user_friends uf
  WHERE uf.requester_id = p.id AND uf.status = 'following'
), 0);
