-- Post_Like: tabela `post_likes`, funcao `toggle_post_like` (RPC, SECURITY
-- DEFINER) e extensao do trigger `prevent_post_counter_tampering` para
-- permitir um bypass sinalizado, autorizando exclusivamente as funcoes deste
-- spec a alterar os contadores de `community_posts`.
--
-- Requirements: 6.1

-- ============ POST_LIKES ============
CREATE TABLE public.post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

CREATE INDEX post_likes_post_idx ON public.post_likes (post_id);
CREATE INDEX post_likes_user_idx ON public.post_likes (user_id);

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Post likes are viewable by everyone"
  ON public.post_likes FOR SELECT USING (true);

-- Nenhuma policy de INSERT/UPDATE/DELETE e criada de proposito: a unica
-- forma autorizada de alterar `post_likes` e atraves da funcao
-- `toggle_post_like` (SECURITY DEFINER) abaixo, que tambem e responsavel por
-- manter o contador `likes` de `community_posts` consistente com esta
-- tabela dentro da mesma transacao.

-- ============ PREVENT_POST_COUNTER_TAMPERING (estendida) ============
-- A versao original (20260522230552_*.sql) sempre reverte NEW.likes/
-- NEW.comments_count para o valor anterior, bloqueando qualquer UPDATE que
-- toque esses campos. Esta versao mantem esse bloqueio por padrao, mas
-- respeita um sinalizador de sessao (`SET LOCAL`, via `set_config(...,
-- true)`) que `toggle_post_like` (e, futuramente, `create_post_comment`)
-- liga imediatamente antes de fazer o UPDATE autorizado em
-- `community_posts`. O sinalizador vale apenas para a transacao atual —
-- nenhum UPDATE fora dessas funcoes, mesmo na mesma sessao, consegue
-- alterar os contadores.
CREATE OR REPLACE FUNCTION public.prevent_post_counter_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('outlife.bypass_post_counters', true) = 'true' THEN
    RETURN NEW;
  END IF;

  NEW.likes := OLD.likes;
  NEW.comments_count := OLD.comments_count;
  RETURN NEW;
END;
$$;

-- ============ TOGGLE_POST_LIKE ============
-- Alterna o Post_Like do usuario autenticado para `_post_id` de forma
-- atomica e idempotente por par (post_id, user_id): faz DELETE primeiro; se
-- nenhuma linha foi removida, faz INSERT. A UNIQUE (post_id, user_id) acima
-- garante que nunca existam duas linhas para o mesmo par, mesmo sob
-- concorrencia.
CREATE OR REPLACE FUNCTION public.toggle_post_like(_post_id uuid)
RETURNS TABLE(liked boolean, likes integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _deleted_count int;
  _liked boolean;
  _likes int;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  DELETE FROM public.post_likes WHERE post_id = _post_id AND user_id = _uid;
  GET DIAGNOSTICS _deleted_count = ROW_COUNT;

  -- Sinaliza o bypass apenas para esta transacao (terceiro argumento `true`
  -- de set_config = SET LOCAL): o trigger `prevent_post_counter_tampering`
  -- permite o UPDATE abaixo e o sinalizador e limpo automaticamente ao fim
  -- da transacao.
  PERFORM set_config('outlife.bypass_post_counters', 'true', true);

  IF _deleted_count > 0 THEN
    UPDATE public.community_posts
      SET likes = GREATEST(COALESCE(likes, 0) - 1, 0)
      WHERE id = _post_id
      RETURNING false, likes INTO _liked, _likes;
  ELSE
    INSERT INTO public.post_likes (post_id, user_id) VALUES (_post_id, _uid);

    UPDATE public.community_posts
      SET likes = COALESCE(likes, 0) + 1
      WHERE id = _post_id
      RETURNING true, likes INTO _liked, _likes;
  END IF;

  IF _likes IS NULL THEN
    RAISE EXCEPTION 'post not found';
  END IF;

  liked := _liked;
  likes := _likes;
  RETURN NEXT;
END;
$$;
