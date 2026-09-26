-- 20260926160000_badges-catalog.sql
-- Badges (Bloco 2): amplia grant_pending_achievements com novas regras (streak
-- e por tipo de atividade) e cria list_my_badges() que retorna o catálogo com
-- flag earned + progress (0..1) para a tela de Conquistas. Idempotente.
--
-- NÃO edita a migration original (20260715160300). CREATE OR REPLACE nas
-- funções. As novas regras usam achievement_records existente (ON CONFLICT).

-- 1) Amplia a concessão de conquistas com streak e marcos por tipo.
CREATE OR REPLACE FUNCTION public.grant_pending_achievements(_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stats public.user_achievement_stats;
  _streak int := 0;
  _cnt_ped int; _cnt_cor int; _cnt_tri int;
BEGIN
  SELECT * INTO stats FROM public.user_achievement_stats WHERE user_id = _user_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Regras originais (mantidas).
  IF stats.completed_activities_count >= 1 THEN
    INSERT INTO public.achievement_records (user_id, rule_code) VALUES (_user_id, 'first_activity')
    ON CONFLICT (user_id, rule_code) DO NOTHING;
  END IF;
  IF stats.total_km >= 100 THEN
    INSERT INTO public.achievement_records (user_id, rule_code) VALUES (_user_id, 'km_100')
    ON CONFLICT (user_id, rule_code) DO NOTHING;
  END IF;
  IF stats.total_km >= 500 THEN
    INSERT INTO public.achievement_records (user_id, rule_code) VALUES (_user_id, 'km_500')
    ON CONFLICT (user_id, rule_code) DO NOTHING;
  END IF;
  IF stats.distinct_destinations_count >= 5 THEN
    INSERT INTO public.achievement_records (user_id, rule_code) VALUES (_user_id, 'explorer')
    ON CONFLICT (user_id, rule_code) DO NOTHING;
  END IF;
  IF stats.photo_reviews_count >= 5 THEN
    INSERT INTO public.achievement_records (user_id, rule_code) VALUES (_user_id, 'top_reviewer')
    ON CONFLICT (user_id, rule_code) DO NOTHING;
  END IF;

  -- Novas: contagem por tipo de atividade (>= 10 atividades concluídas).
  SELECT
    COUNT(*) FILTER (WHERE activity_type = 'pedalada'),
    COUNT(*) FILTER (WHERE activity_type = 'corrida'),
    COUNT(*) FILTER (WHERE activity_type = 'trilha')
  INTO _cnt_ped, _cnt_cor, _cnt_tri
  FROM public.user_activities WHERE user_id = _user_id AND status = 'completed';

  IF coalesce(_cnt_ped,0) >= 10 THEN
    INSERT INTO public.achievement_records (user_id, rule_code) VALUES (_user_id, 'pedalada_10')
    ON CONFLICT (user_id, rule_code) DO NOTHING;
  END IF;
  IF coalesce(_cnt_cor,0) >= 10 THEN
    INSERT INTO public.achievement_records (user_id, rule_code) VALUES (_user_id, 'corrida_10')
    ON CONFLICT (user_id, rule_code) DO NOTHING;
  END IF;
  IF coalesce(_cnt_tri,0) >= 10 THEN
    INSERT INTO public.achievement_records (user_id, rule_code) VALUES (_user_id, 'trilha_10')
    ON CONFLICT (user_id, rule_code) DO NOTHING;
  END IF;

  -- Novas: streak (dias consecutivos). Reusa a mesma lógica de my_activity_streak,
  -- mas para _user_id (a RPC pública só lê o próprio; aqui é SECURITY DEFINER).
  WITH RECURSIVE days AS (
    SELECT (CASE
      WHEN EXISTS (SELECT 1 FROM public.user_activities ua WHERE ua.user_id=_user_id AND ua.status='completed'
                   AND (ua.start_time AT TIME ZONE 'America/Sao_Paulo')::date = current_date)
      THEN current_date
      WHEN EXISTS (SELECT 1 FROM public.user_activities ua WHERE ua.user_id=_user_id AND ua.status='completed'
                   AND (ua.start_time AT TIME ZONE 'America/Sao_Paulo')::date = current_date - 1)
      THEN current_date - 1
      ELSE NULL END) AS d, 1 AS n
    UNION ALL
    SELECT days.d - 1, days.n + 1 FROM days
    WHERE days.d IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.user_activities ua WHERE ua.user_id=_user_id AND ua.status='completed'
                  AND (ua.start_time AT TIME ZONE 'America/Sao_Paulo')::date = days.d - 1)
      AND days.n < 400
  )
  SELECT coalesce(max(n),0) INTO _streak FROM days WHERE d IS NOT NULL;

  IF _streak >= 7 THEN
    INSERT INTO public.achievement_records (user_id, rule_code) VALUES (_user_id, 'streak_7')
    ON CONFLICT (user_id, rule_code) DO NOTHING;
  END IF;
  IF _streak >= 30 THEN
    INSERT INTO public.achievement_records (user_id, rule_code) VALUES (_user_id, 'streak_30')
    ON CONFLICT (user_id, rule_code) DO NOTHING;
  END IF;
END;
$$;

-- 2) list_my_badges(): catálogo + earned + progress (0..1) para o auth.uid().
CREATE OR REPLACE FUNCTION public.list_my_badges()
RETURNS TABLE (
  code text,
  earned boolean,
  progress numeric
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  s public.user_achievement_stats;
  _streak int := 0;
  _ped int; _cor int; _tri int; _dest int;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  SELECT * INTO s FROM public.user_achievement_stats WHERE user_id = _uid;

  SELECT
    COUNT(*) FILTER (WHERE activity_type = 'pedalada'),
    COUNT(*) FILTER (WHERE activity_type = 'corrida'),
    COUNT(*) FILTER (WHERE activity_type = 'trilha')
  INTO _ped, _cor, _tri
  FROM public.user_activities WHERE user_id = _uid AND status = 'completed';

  SELECT COUNT(DISTINCT destination_id) INTO _dest
  FROM public.user_destination_visits WHERE user_id = _uid;

  SELECT public.my_activity_streak() INTO _streak;

  RETURN QUERY
  WITH cat(code, prog) AS (
    VALUES
      ('first_activity', LEAST(coalesce(s.completed_activities_count,0)::numeric / 1, 1)),
      ('km_100',        LEAST(coalesce(s.total_km,0)::numeric / 100, 1)),
      ('km_500',        LEAST(coalesce(s.total_km,0)::numeric / 500, 1)),
      ('explorer',      LEAST(coalesce(s.distinct_destinations_count,0)::numeric / 5, 1)),
      ('top_reviewer',  LEAST(coalesce(s.photo_reviews_count,0)::numeric / 5, 1)),
      ('destinos_1',    LEAST(coalesce(_dest,0)::numeric / 1, 1)),
      ('destinos_5',    LEAST(coalesce(_dest,0)::numeric / 5, 1)),
      ('destinos_10',   LEAST(coalesce(_dest,0)::numeric / 10, 1)),
      ('pedalada_10',   LEAST(coalesce(_ped,0)::numeric / 10, 1)),
      ('corrida_10',    LEAST(coalesce(_cor,0)::numeric / 10, 1)),
      ('trilha_10',     LEAST(coalesce(_tri,0)::numeric / 10, 1)),
      ('streak_7',      LEAST(coalesce(_streak,0)::numeric / 7, 1)),
      ('streak_30',     LEAST(coalesce(_streak,0)::numeric / 30, 1))
  )
  SELECT c.code,
         (ar.rule_code IS NOT NULL) AS earned,
         round(c.prog, 3) AS progress
  FROM cat c
  LEFT JOIN public.achievement_records ar
    ON ar.user_id = _uid AND ar.rule_code = c.code;
END;
$$;
REVOKE ALL ON FUNCTION public.list_my_badges() FROM public;
GRANT EXECUTE ON FUNCTION public.list_my_badges() TO authenticated;
