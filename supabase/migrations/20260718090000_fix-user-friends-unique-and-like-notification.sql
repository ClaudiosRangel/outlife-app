-- Corrige dois problemas encontrados em produção:
--
-- 1) Bug real no erro "Não foi possível seguir": a constraint
--    `user_friends_unique` era `UNIQUE (requester_id, addressee_id)`, sem
--    incluir `status`. Como Friendship (`pending`/`accepted`/`blocked`) e
--    Post_Follow (`following`) foram modelados na mesma tabela
--    `user_friends` (decisão de design do Requirement 7.1), dois usuários
--    que já são amigos `accepted` nunca conseguiam também ter uma linha
--    `following` entre eles: o INSERT de `toggleAuthorFollow` sempre
--    violava essa constraint (23505 duplicate key), sem relação alguma com
--    RLS/permissão. Corrigido incluindo `status` na constraint única, para
--    que o mesmo par de usuários possa ter uma linha `accepted` e uma linha
--    `following` coexistindo.
--
-- 2) Notificação ao curtir: estende o padrão já usado por
--    `notify_on_friend_request` (Requirement 9.2) para também notificar o
--    autor de um Community_Post quando alguém curte a publicação, via
--    trigger AFTER INSERT em `post_likes`.

-- ============ 1) Corrige a constraint UNIQUE de user_friends ============
ALTER TABLE public.user_friends
  DROP CONSTRAINT IF EXISTS user_friends_unique;

ALTER TABLE public.user_friends
  ADD CONSTRAINT user_friends_unique UNIQUE (requester_id, addressee_id, status);

-- ============ 2) Notificação de curtida (post_like) ============
CREATE OR REPLACE FUNCTION public.notify_on_post_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _author_id uuid;
BEGIN
  SELECT author_id INTO _author_id FROM public.community_posts WHERE id = NEW.post_id;

  -- Nunca notifica o próprio autor curtindo o próprio post.
  IF _author_id IS NOT NULL AND _author_id <> NEW.user_id THEN
    INSERT INTO public.notifications (recipient_id, type, payload)
    VALUES (
      _author_id,
      'post_like',
      jsonb_build_object('postId', NEW.post_id, 'likerId', NEW.user_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_post_like ON public.post_likes;
CREATE TRIGGER trg_notify_on_post_like
  AFTER INSERT ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_post_like();
