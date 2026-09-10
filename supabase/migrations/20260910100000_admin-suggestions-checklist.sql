-- ============================================================================
-- Área administrativa — Dicas/Melhorias (checklist)
-- ============================================================================
-- Tabela para os admins registrarem dicas/melhorias do app como itens de
-- checklist: cada item nasce PENDENTE e pode ser marcado como PRONTO (done).
-- Acesso exclusivo de admin (public.is_admin), tanto leitura quanto escrita.
-- Tudo idempotente (IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  done BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  done_at TIMESTAMPTZ,
  done_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS admin_suggestions_done_idx
  ON public.admin_suggestions (done, created_at DESC);

ALTER TABLE public.admin_suggestions ENABLE ROW LEVEL SECURITY;

-- Somente admins enxergam e gerenciam as dicas/melhorias.
DROP POLICY IF EXISTS "Admins select suggestions" ON public.admin_suggestions;
CREATE POLICY "Admins select suggestions"
  ON public.admin_suggestions FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins insert suggestions" ON public.admin_suggestions;
CREATE POLICY "Admins insert suggestions"
  ON public.admin_suggestions FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()) AND auth.uid() = created_by);

DROP POLICY IF EXISTS "Admins update suggestions" ON public.admin_suggestions;
CREATE POLICY "Admins update suggestions"
  ON public.admin_suggestions FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins delete suggestions" ON public.admin_suggestions;
CREATE POLICY "Admins delete suggestions"
  ON public.admin_suggestions FOR DELETE
  USING (public.is_admin(auth.uid()));
