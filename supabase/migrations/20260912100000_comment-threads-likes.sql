-- ============================================================================
-- Frente C (spec evolucao-admin-atividades-social) — Comentários:
-- respostas (threads), curtidas e exclusão (autor/admin). Idempotente.
-- ============================================================================

-- 1) Threads: comentário-pai (nullable = comentário raiz). Cascade: excluir o
--    pai remove as respostas.
ALTER TABLE public.post_comments
  ADD COLUMN IF NOT EXISTS parent_comment_id UUID
  REFERENCES public.post_comments(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS post_comments_parent_idx
  ON public.post_comments(parent_comment_id);

-- 2) Contador desnormalizado de curtidas por comentário.
ALTER TABLE public.post_comments
  ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0;

-- 3) Curtidas de comentário/resposta (idempotente por usuário via UNIQUE).
CREATE TABLE IF NOT EXISTS public.comment_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id)
);
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read comment_likes" ON public.comment_likes;
CREATE POLICY "read comment_likes" ON public.comment_likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "insert own comment_like" ON public.comment_likes;
CREATE POLICY "insert own comment_like" ON public.comment_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete own comment_like" ON public.comment_likes;
CREATE POLICY "delete own comment_like" ON public.comment_likes FOR DELETE
  USING (auth.uid() = user_id);

-- 4) Exclusão de comentário: autor OU admin (estende a policy de DELETE).
DROP POLICY IF EXISTS "delete own or admin comment" ON public.post_comments;
CREATE POLICY "delete own or admin comment" ON public.post_comments FOR DELETE
  USING (auth.uid() = author_id OR public.is_admin(auth.uid()));

-- 5) create_post_comment estendida: aceita _parent_comment_id opcional.
--    Respostas contam para o comments_count do post (conversa inteira).
CREATE OR REPLACE FUNCTION public.create_post_comment(
  _post_id uuid, _text text, _parent_comment_id uuid DEFAULT NULL
)
RETURNS public.post_comments
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _row public.post_comments;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF length(btrim(_text)) = 0 THEN RAISE EXCEPTION 'comment text is blank'; END IF;

  INSERT INTO public.post_comments (post_id, author_id, text, parent_comment_id)
  VALUES (_post_id, _uid, btrim(_text), _parent_comment_id)
  RETURNING * INTO _row;

  PERFORM set_config('outlife.bypass_post_counters', 'true', true);
  UPDATE public.community_posts
     SET comments_count = comments_count + 1
   WHERE id = _post_id;

  RETURN _row;
END;
$function$;

-- 6) toggle_comment_like: curte/descurte idempotente e ajusta likes_count.
CREATE OR REPLACE FUNCTION public.toggle_comment_like(_comment_id uuid)
RETURNS TABLE (liked boolean, likes_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _exists boolean;
  _count integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.comment_likes WHERE comment_id = _comment_id AND user_id = _uid
  ) INTO _exists;

  IF _exists THEN
    DELETE FROM public.comment_likes WHERE comment_id = _comment_id AND user_id = _uid;
    UPDATE public.post_comments
       SET likes_count = GREATEST(0, likes_count - 1)
     WHERE id = _comment_id
     RETURNING likes_count INTO _count;
    RETURN QUERY SELECT false, COALESCE(_count, 0);
  ELSE
    INSERT INTO public.comment_likes (comment_id, user_id) VALUES (_comment_id, _uid)
      ON CONFLICT (comment_id, user_id) DO NOTHING;
    UPDATE public.post_comments
       SET likes_count = likes_count + 1
     WHERE id = _comment_id
     RETURNING likes_count INTO _count;
    RETURN QUERY SELECT true, COALESCE(_count, 0);
  END IF;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.toggle_comment_like(uuid) TO authenticated;

-- 7) delete_post_comment: autor OU admin; remove o comentário (cascata leva
--    replies e likes) e decrementa comments_count pelo total removido.
CREATE OR REPLACE FUNCTION public.delete_post_comment(_comment_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _author uuid;
  _post uuid;
  _removed integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT author_id, post_id INTO _author, _post
  FROM public.post_comments WHERE id = _comment_id;
  IF _author IS NULL THEN RETURN; END IF; -- já não existe

  IF _author <> _uid AND NOT public.is_admin(_uid) THEN
    RAISE EXCEPTION 'not authorized to delete this comment';
  END IF;

  -- Conta o comentário + suas respostas diretas (que serão removidas em cascata)
  SELECT 1 + COUNT(*) INTO _removed
  FROM public.post_comments WHERE parent_comment_id = _comment_id;

  DELETE FROM public.post_comments WHERE id = _comment_id;  -- cascata: replies + likes

  PERFORM set_config('outlife.bypass_post_counters', 'true', true);
  UPDATE public.community_posts
     SET comments_count = GREATEST(0, comments_count - _removed)
   WHERE id = _post;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.delete_post_comment(uuid) TO authenticated;
