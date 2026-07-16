-- Achievement_Record: tabela, view de estatisticas, funcao de concessao e triggers.
--
-- Requirements: 5.1, 5.2, 5.6
--
-- Requirement 5.6 (nao gerar Achievement_Record para atividade de usuario nao
-- autenticado) NAO e implementado como uma checagem adicional nesta migration.
-- Ele decorre estruturalmente de duas garantias ja existentes nas tabelas
-- `reviews` e `user_activities` (ver 20260522173346_*.sql e 20260522214044_*.sql):
--   1. `author_id`/`user_id` sao colunas `NOT NULL` com FK para `public.profiles`,
--      portanto nao existe linha em `reviews`/`user_activities` sem um usuario
--      associado.
--   2. As policies de RLS de INSERT dessas tabelas exigem `auth.uid() = author_id`
--      / `auth.uid() = user_id`, portanto nenhuma linha pode ser inserida por uma
--      sessao nao autenticada (ou em nome de outro usuario) em primeiro lugar.
-- Como os triggers abaixo disparam a partir de linhas que ja passaram por essas
-- garantias, `grant_pending_achievements` sempre recebe um `_user_id` de um
-- usuario autenticado real; nao ha caminho de execucao em que uma atividade
-- "sem usuario autenticado" chegue a gerar um Achievement_Record.

-- ============ ACHIEVEMENT_RECORDS ============
CREATE TABLE public.achievement_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rule_code TEXT NOT NULL,
  achieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, rule_code)
);

CREATE INDEX achievement_records_user_idx ON public.achievement_records (user_id);

ALTER TABLE public.achievement_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own achievements"
  ON public.achievement_records FOR SELECT
  USING (auth.uid() = user_id);

-- Nenhuma policy de INSERT/UPDATE/DELETE e criada de proposito: a concessao de
-- Achievement_Record ocorre exclusivamente via a funcao SECURITY DEFINER
-- `grant_pending_achievements` abaixo, nunca por uma escrita direta do cliente.
-- Isso fecha a possibilidade de um usuario se autoconceder um achievement
-- (Requirement 5.2), ja que RLS sem policy permissiva bloqueia toda escrita
-- vinda de uma sessao autenticada comum.

-- ============ USER_ACHIEVEMENT_STATS (view de suporte) ============
CREATE VIEW public.user_achievement_stats AS
SELECT
  p.id AS user_id,
  COALESCE(SUM(ua.distance_meters) / 1000, 0) AS total_km,
  COUNT(ua.id) AS completed_activities_count,
  COUNT(DISTINCT ua.destination_id) AS distinct_destinations_count,
  COUNT(r.id) FILTER (WHERE r.image_url IS NOT NULL) AS photo_reviews_count
FROM public.profiles p
LEFT JOIN public.user_activities ua ON ua.user_id = p.id AND ua.status = 'completed'
LEFT JOIN public.reviews r ON r.author_id = p.id
GROUP BY p.id;

-- ============ GRANT_PENDING_ACHIEVEMENTS ============
-- Catalogo de Achievement_Rule simples, baseado exclusivamente nas colunas
-- disponiveis em `user_achievement_stats`. Mantido em codigo (nesta funcao),
-- nao em tabela separada, conforme design.md.
CREATE OR REPLACE FUNCTION public.grant_pending_achievements(_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stats public.user_achievement_stats;
BEGIN
  SELECT * INTO stats
  FROM public.user_achievement_stats
  WHERE user_id = _user_id;

  -- Se o usuario nao existe em `profiles` (nunca deveria ocorrer, ja que
  -- `_user_id` sempre vem de uma FK valida), nao ha estatisticas: nada a conceder.
  IF stats.user_id IS NULL THEN
    RETURN;
  END IF;

  -- Regra 'first_activity': concluiu ao menos 1 atividade.
  IF stats.completed_activities_count >= 1 THEN
    INSERT INTO public.achievement_records (user_id, rule_code)
    VALUES (_user_id, 'first_activity')
    ON CONFLICT (user_id, rule_code) DO NOTHING;
  END IF;

  -- Regra 'km_100': percorreu ao menos 100 km somados em atividades concluidas.
  IF stats.total_km >= 100 THEN
    INSERT INTO public.achievement_records (user_id, rule_code)
    VALUES (_user_id, 'km_100')
    ON CONFLICT (user_id, rule_code) DO NOTHING;
  END IF;

  -- Regra 'km_500': percorreu ao menos 500 km somados em atividades concluidas.
  IF stats.total_km >= 500 THEN
    INSERT INTO public.achievement_records (user_id, rule_code)
    VALUES (_user_id, 'km_500')
    ON CONFLICT (user_id, rule_code) DO NOTHING;
  END IF;

  -- Regra 'explorer': concluiu atividades em ao menos 5 destinos distintos.
  IF stats.distinct_destinations_count >= 5 THEN
    INSERT INTO public.achievement_records (user_id, rule_code)
    VALUES (_user_id, 'explorer')
    ON CONFLICT (user_id, rule_code) DO NOTHING;
  END IF;

  -- Regra 'top_reviewer': publicou ao menos 5 avaliacoes com foto.
  IF stats.photo_reviews_count >= 5 THEN
    INSERT INTO public.achievement_records (user_id, rule_code)
    VALUES (_user_id, 'top_reviewer')
    ON CONFLICT (user_id, rule_code) DO NOTHING;
  END IF;
END;
$$;

-- ============ TRIGGERS ============
-- Disparam grant_pending_achievements sempre que a atividade real do usuario
-- muda nas duas tabelas que alimentam user_achievement_stats.

CREATE OR REPLACE FUNCTION public.trg_grant_achievements_on_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.grant_pending_achievements(NEW.author_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grant_achievements_on_review ON public.reviews;
CREATE TRIGGER trg_grant_achievements_on_review
  AFTER INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.trg_grant_achievements_on_review();

CREATE OR REPLACE FUNCTION public.trg_grant_achievements_on_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.grant_pending_achievements(NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grant_achievements_on_activity ON public.user_activities;
CREATE TRIGGER trg_grant_achievements_on_activity
  AFTER INSERT OR UPDATE ON public.user_activities
  FOR EACH ROW EXECUTE FUNCTION public.trg_grant_achievements_on_activity();
