-- Post_Comment (Requirement 8)
--
-- Tabela dedicada a comentários de Community_Post, com RLS restringindo a
-- criação ao próprio autor autenticado, e RPC create_post_comment que
-- persiste o comentário e incrementa community_posts.comments_count de
-- forma atômica, reaproveitando o mesmo sinalizador de sessão
-- (`outlife.bypass_post_counters`) usado por toggle_post_like (Migration A,
-- 20260716090000_post-likes-toggle-function.sql) para contornar o trigger
-- prevent_post_counter_tampering de forma autorizada.

-- 1. Tabela post_comments
CREATE TABLE public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT post_comments_text_not_blank CHECK (length(btrim(text)) > 0)
);

CREATE INDEX post_comments_post_id_idx ON public.post_comments (post_id, created_at);

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments are viewable by everyone"
  ON public.post_comments FOR SELECT
  USING (true);

CREATE POLICY "Users create their own comments"
  ON public.post_comments FOR INSERT
  WITH CHECK (auth.uid() = author_id);

-- 2. Função create_post_comment
--
-- SECURITY DEFINER para poder, dentro da mesma transação, inserir o
-- comentário e sinalizar o bypass do trigger de contadores de
-- community_posts (o mesmo mecanismo `outlife.bypass_post_counters` da
-- Migration A) para incrementar comments_count -- nunca através de um
-- UPDATE direto do cliente (Requirement 8.4).
CREATE OR REPLACE FUNCTION public.create_post_comment(_post_id uuid, _text text)
RETURNS public.post_comments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.post_comments;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF length(btrim(_text)) = 0 THEN
    RAISE EXCEPTION 'comment text is blank';
  END IF;

  INSERT INTO public.post_comments (post_id, author_id, text)
  VALUES (_post_id, _uid, btrim(_text))
  RETURNING * INTO _row;

  PERFORM set_config('outlife.bypass_post_counters', 'true', true);

  UPDATE public.community_posts
     SET comments_count = comments_count + 1
   WHERE id = _post_id;

  RETURN _row;
END;
$$;
