-- ============================================================================
-- Área administrativa: conteúdo editável da Home + dashboard de métricas
-- ============================================================================
-- 2a) app_content: pares chave→texto editáveis pelo admin. A Home lê estas
--     chaves e, quando existem, sobrescrevem o texto default do i18n.
-- 2b) admin_dashboard_stats(): RPC SECURITY DEFINER que devolve totais do app
--     (usuários, ativos, publicações, interações, etc.) — só para admin.
-- Idempotente. RLS: leitura de app_content é pública (a Home precisa ler);
-- escrita só admin.
-- ============================================================================

-- ---------- 2a) Conteúdo editável ----------
CREATE TABLE IF NOT EXISTS public.app_content (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.app_content ENABLE ROW LEVEL SECURITY;

-- Leitura pública: qualquer visitante da Home precisa enxergar os textos.
DROP POLICY IF EXISTS "Anyone reads app_content" ON public.app_content;
CREATE POLICY "Anyone reads app_content"
  ON public.app_content FOR SELECT USING (true);

-- Escrita só admin.
DROP POLICY IF EXISTS "Admins upsert app_content" ON public.app_content;
CREATE POLICY "Admins upsert app_content"
  ON public.app_content FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins update app_content" ON public.app_content;
CREATE POLICY "Admins update app_content"
  ON public.app_content FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ---------- 2b) Dashboard de métricas ----------
-- Retorna um JSON com os totais. SECURITY DEFINER para poder ler auth.users
-- (last_sign_in_at) e agregar várias tabelas; exige admin explicitamente.
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _result JSONB;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT jsonb_build_object(
    'usuarios_total', (SELECT count(*) FROM public.profiles),
    'usuarios_verificados', (SELECT count(*) FROM public.profiles WHERE is_verified),
    'ativos_7d', (SELECT count(*) FROM auth.users WHERE last_sign_in_at >= now() - interval '7 days'),
    'ativos_30d', (SELECT count(*) FROM auth.users WHERE last_sign_in_at >= now() - interval '30 days'),
    'novos_7d', (SELECT count(*) FROM public.profiles WHERE created_at >= now() - interval '7 days'),
    'publicacoes_total', (SELECT count(*) FROM public.community_posts),
    'publicacoes_7d', (SELECT count(*) FROM public.community_posts WHERE created_at >= now() - interval '7 days'),
    'curtidas_total', (SELECT count(*) FROM public.post_likes),
    'comentarios_total', (SELECT count(*) FROM public.post_comments),
    'avaliacoes_total', (SELECT count(*) FROM public.reviews),
    'interacoes_total', (
      (SELECT count(*) FROM public.post_likes) +
      (SELECT count(*) FROM public.post_comments) +
      (SELECT count(*) FROM public.reviews)
    ),
    'atividades_total', (SELECT count(*) FROM public.user_activities),
    'atividades_7d', (SELECT count(*) FROM public.user_activities WHERE start_time >= now() - interval '7 days'),
    'eventos_total', (SELECT count(*) FROM public.events),
    'destinos_total', (SELECT count(*) FROM public.destinations),
    'leads_total', (SELECT count(*) FROM public.partner_leads)
  ) INTO _result;

  RETURN _result;
END; $$;

GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;

-- Semente dos textos default da Home (só cria se ainda não existir — não
-- sobrescreve edições já feitas pelo admin).
INSERT INTO public.app_content (key, value) VALUES
  ('home.slogan', '“A vida não é só trilhar.
Viver é diferente
de estar vivo.”'),
  ('home.ecosystem', 'OutVitar · ecossistema')
ON CONFLICT (key) DO NOTHING;
