-- ============================================================================
-- Correções pós-teste do bloco evolucao-admin-atividades-social:
--   (Ponto 3) Ambiguidade PGRST203 em create_post_comment: existem 2 versões
--     (2 args e 3 args). O PostgREST não sabe qual chamar → comentar/curtir
--     falha ("Não foi possível comentar"). Removemos a versão antiga de 2 args,
--     mantendo só a de 3 (_parent_comment_id opcional).
--   (Ponto 5) Novos tipos de atividade no catálogo: Voo livre, Surf, Skate.
-- Idempotente.
-- ============================================================================

-- (3) Remove a assinatura antiga (2 args). A de 3 args (com _parent_comment_id)
--     cobre o caso sem parent via DEFAULT NULL.
DROP FUNCTION IF EXISTS public.create_post_comment(uuid, text);

-- (5) Novos tipos de atividade (idempotente por code). metric_form:
--     - voo_livre / surf / skate → speed_elevation (velocidade + elevação),
--       forma mais próxima do que faz sentido exibir para essas modalidades.
INSERT INTO public.activity_types (code, name, icon_key, metric_form, active, position)
VALUES
  ('voo_livre', 'Voo livre', 'flight', 'speed_elevation', true,
     COALESCE((SELECT MAX(position) FROM public.activity_types), 0) + 1),
  ('surf', 'Surf', 'surf', 'speed_elevation', true,
     COALESCE((SELECT MAX(position) FROM public.activity_types), 0) + 2),
  ('skate', 'Skate', 'skate', 'speed_elevation', true,
     COALESCE((SELECT MAX(position) FROM public.activity_types), 0) + 3)
ON CONFLICT (code) DO NOTHING;
