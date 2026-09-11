-- ============================================================================
-- "Dê sua opinião" — feedback do usuário sobre o app
-- ============================================================================
-- Qualquer usuário autenticado envia uma opinião (texto + nota opcional 1-5).
-- Admin lê tudo na Administração. O autor pode ver as próprias.
-- Idempotente.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_feedback_created_idx ON public.user_feedback (created_at DESC);

ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

-- Autor cria a própria opinião.
DROP POLICY IF EXISTS "Users create own feedback" ON public.user_feedback;
CREATE POLICY "Users create own feedback"
  ON public.user_feedback FOR INSERT
  WITH CHECK (auth.uid() = author_id);

-- Autor vê as próprias; admin vê todas.
DROP POLICY IF EXISTS "Author or admin reads feedback" ON public.user_feedback;
CREATE POLICY "Author or admin reads feedback"
  ON public.user_feedback FOR SELECT
  USING (auth.uid() = author_id OR public.is_admin(auth.uid()));

-- Admin pode remover (moderação).
DROP POLICY IF EXISTS "Admin deletes feedback" ON public.user_feedback;
CREATE POLICY "Admin deletes feedback"
  ON public.user_feedback FOR DELETE
  USING (public.is_admin(auth.uid()));

-- RPC para o admin listar as opiniões com nome/avatar do autor (evita expor
-- a tabela profiles inteira via embed e simplifica o front).
CREATE OR REPLACE FUNCTION public.admin_fetch_feedback(_limit INTEGER DEFAULT 100)
RETURNS TABLE (id UUID, author_id UUID, full_name TEXT, avatar_url TEXT, rating INTEGER, message TEXT, created_at TIMESTAMPTZ)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT f.id, f.author_id, p.full_name, p.avatar_url, f.rating, f.message, f.created_at
  FROM public.user_feedback f
  JOIN public.profiles p ON p.id = f.author_id
  WHERE public.is_admin(auth.uid())
  ORDER BY f.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 100), 500));
$$;
GRANT EXECUTE ON FUNCTION public.admin_fetch_feedback(INTEGER) TO authenticated;
