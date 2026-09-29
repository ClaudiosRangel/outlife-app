-- 20260928120000_destination-comments-visitors.sql
-- Frente B (popular Explorar): comentários no destino (com avatar do autor) +
-- "quem já esteve" no destino (visitantes/amigos). Reusa user_destination_visits
-- (visitas por GPS) e profiles. Idempotente.

-- ============ 1) Comentários do destino ============
CREATE TABLE IF NOT EXISTS public.destination_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_id UUID NOT NULL REFERENCES public.destinations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL CHECK (char_length(btrim(text)) BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS destination_comments_dest_idx
  ON public.destination_comments(destination_id, created_at DESC);

ALTER TABLE public.destination_comments ENABLE ROW LEVEL SECURITY;

-- Leitura pública (comentários são visíveis a todos).
DROP POLICY IF EXISTS "destination_comments_select_all" ON public.destination_comments;
CREATE POLICY "destination_comments_select_all"
  ON public.destination_comments FOR SELECT USING (true);

-- Escreve o próprio comentário.
DROP POLICY IF EXISTS "destination_comments_insert_own" ON public.destination_comments;
CREATE POLICY "destination_comments_insert_own"
  ON public.destination_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Apaga o próprio comentário (admin trata via RPC dedicada se necessário).
DROP POLICY IF EXISTS "destination_comments_delete_own" ON public.destination_comments;
CREATE POLICY "destination_comments_delete_own"
  ON public.destination_comments FOR DELETE USING (auth.uid() = user_id);

-- Lista comentários com avatar/nome do autor (join profiles). Leitura pública.
CREATE OR REPLACE FUNCTION public.fetch_destination_comments(
  _destination_id uuid,
  _limit int DEFAULT 100
) RETURNS TABLE (
  id uuid,
  user_id uuid,
  full_name text,
  username text,
  avatar_url text,
  text text,
  created_at timestamptz,
  is_me boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id, c.user_id, p.full_name, p.username, p.avatar_url, c.text, c.created_at,
         (c.user_id = auth.uid())
  FROM public.destination_comments c
  JOIN public.profiles p ON p.id = c.user_id
  WHERE c.destination_id = _destination_id
  ORDER BY c.created_at DESC
  LIMIT greatest(1, least(_limit, 200));
$$;
REVOKE ALL ON FUNCTION public.fetch_destination_comments(uuid, int) FROM public;
GRANT EXECUTE ON FUNCTION public.fetch_destination_comments(uuid, int) TO anon, authenticated;

-- Adiciona um comentário (retorna a linha já com avatar/nome para render).
CREATE OR REPLACE FUNCTION public.add_destination_comment(
  _destination_id uuid,
  _text text
) RETURNS TABLE (
  id uuid,
  user_id uuid,
  full_name text,
  username text,
  avatar_url text,
  text text,
  created_at timestamptz,
  is_me boolean
)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF btrim(coalesce(_text,'')) = '' THEN RAISE EXCEPTION 'empty comment'; END IF;
  INSERT INTO public.destination_comments (destination_id, user_id, text)
  VALUES (_destination_id, _uid, btrim(_text))
  RETURNING destination_comments.id INTO _id;
  RETURN QUERY
    SELECT c.id, c.user_id, p.full_name, p.username, p.avatar_url, c.text, c.created_at, true
    FROM public.destination_comments c JOIN public.profiles p ON p.id = c.user_id
    WHERE c.id = _id;
END;
$$;
REVOKE ALL ON FUNCTION public.add_destination_comment(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.add_destination_comment(uuid, text) TO authenticated;

-- ============ 2) Quem já esteve no destino ============
-- Visitantes do destino (via user_destination_visits, populada por GPS ao
-- concluir atividade). Leitura pública com avatar/nome; marca se é amigo do
-- solicitante (accepted/following) e o total. SECURITY DEFINER (a tabela de
-- visitas tem RLS de leitura própria).
CREATE OR REPLACE FUNCTION public.fetch_destination_visitors(
  _destination_id uuid,
  _limit int DEFAULT 30
) RETURNS TABLE (
  user_id uuid,
  full_name text,
  username text,
  avatar_url text,
  visited_at timestamptz,
  is_friend boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT v.user_id, p.full_name, p.username, p.avatar_url, v.visited_at,
    EXISTS (
      SELECT 1 FROM public.user_friends uf
      WHERE uf.status IN ('accepted','following')
        AND ((uf.requester_id = auth.uid() AND uf.addressee_id = v.user_id)
          OR (uf.addressee_id = auth.uid() AND uf.requester_id = v.user_id))
    ) AS is_friend
  FROM public.user_destination_visits v
  JOIN public.profiles p ON p.id = v.user_id
  WHERE v.destination_id = _destination_id
  ORDER BY is_friend DESC, v.visited_at DESC
  LIMIT greatest(1, least(_limit, 100));
$$;
REVOKE ALL ON FUNCTION public.fetch_destination_visitors(uuid, int) FROM public;
GRANT EXECUTE ON FUNCTION public.fetch_destination_visitors(uuid, int) TO anon, authenticated;
