-- 20260926150000_league-weekly-fix-geral-key.sql
-- Correção: a liga "geral" usava activity_type NULL, mas NULL não pode compor
-- PK (NOT NULL). Passa a usar a SENTINELA '' (string vazia) para "geral" nas
-- tabelas de estado (user_league_divisions, league_rollover_log). As RPCs
-- continuam recebendo NULL do cliente e normalizam para '' internamente.
-- Idempotente.

-- 1) Normaliza colunas para NOT NULL DEFAULT '' (converte NULLs já existentes).
UPDATE public.user_league_divisions SET activity_type = '' WHERE activity_type IS NULL;
UPDATE public.league_rollover_log   SET activity_type = '' WHERE activity_type IS NULL;

ALTER TABLE public.user_league_divisions
  ALTER COLUMN activity_type SET DEFAULT '',
  ALTER COLUMN activity_type SET NOT NULL;
ALTER TABLE public.league_rollover_log
  ALTER COLUMN activity_type SET DEFAULT '',
  ALTER COLUMN activity_type SET NOT NULL;

-- Índices parciais da variante "geral" (NULL) não são mais necessários.
DROP INDEX IF EXISTS public.user_league_divisions_geral_uidx;
DROP INDEX IF EXISTS public.league_rollover_log_geral_uidx;

-- 2) Rollover: normaliza _activity_type (NULL→'') e filtra por igualdade.
CREATE OR REPLACE FUNCTION public.process_league_rollover(
  _week_start date,
  _activity_type text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _promote_n int := 3;
  _relegate_n int := 3;
  _min_for_relegation int := 8;
  _atype text := coalesce(_activity_type, '');
BEGIN
  BEGIN
    INSERT INTO public.league_rollover_log (week_start, activity_type)
    VALUES (_week_start, _atype);
  EXCEPTION WHEN unique_violation THEN
    RETURN;
  END;

  WITH week_pts AS (
    SELECT ua.user_id,
           SUM(public.league_points_expr(ua.distance_meters, ua.elevation_gain)) AS pts
    FROM public.user_activities ua
    WHERE ua.status = 'completed'
      AND (ua.start_time AT TIME ZONE 'America/Sao_Paulo')::date >= _week_start
      AND (ua.start_time AT TIME ZONE 'America/Sao_Paulo')::date <  _week_start + 7
      AND (_atype = '' OR ua.activity_type = _atype)
    GROUP BY ua.user_id
  ),
  ranked AS (
    SELECT d.user_id, d.division, coalesce(w.pts,0) AS pts,
           ROW_NUMBER() OVER (PARTITION BY d.division ORDER BY coalesce(w.pts,0) DESC, d.user_id) AS rn_top,
           ROW_NUMBER() OVER (PARTITION BY d.division ORDER BY coalesce(w.pts,0) ASC, d.user_id) AS rn_bot,
           COUNT(*) FILTER (WHERE coalesce(w.pts,0) > 0) OVER (PARTITION BY d.division) AS active_in_div
    FROM public.user_league_divisions d
    LEFT JOIN week_pts w ON w.user_id = d.user_id
    WHERE d.activity_type = _atype
  ),
  moves AS (
    SELECT user_id, division,
      CASE
        WHEN pts > 0 AND rn_top <= _promote_n AND division <> 'diamante' THEN
          CASE division WHEN 'bronze' THEN 'prata' WHEN 'prata' THEN 'ouro' WHEN 'ouro' THEN 'diamante' END
        WHEN rn_bot <= _relegate_n AND active_in_div >= _min_for_relegation AND division <> 'bronze' THEN
          CASE division WHEN 'diamante' THEN 'ouro' WHEN 'ouro' THEN 'prata' WHEN 'prata' THEN 'bronze' END
        ELSE division
      END AS new_division
    FROM ranked
  )
  UPDATE public.user_league_divisions d
     SET division = m.new_division,
         updated_week = _week_start
    FROM moves m
   WHERE d.user_id = m.user_id
     AND d.activity_type = _atype
     AND m.new_division <> d.division;
END;
$$;
REVOKE ALL ON FUNCTION public.process_league_rollover(date, text) FROM public;
GRANT EXECUTE ON FUNCTION public.process_league_rollover(date, text) TO authenticated;

-- 3) Standings: normaliza _activity_type (NULL→'') em todas as referências.
CREATE OR REPLACE FUNCTION public.fetch_league_standings(
  _activity_type text DEFAULT NULL,
  _limit integer DEFAULT 50
) RETURNS TABLE (
  user_id uuid,
  full_name text,
  username text,
  avatar_url text,
  points integer,
  division text,
  is_me boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _this_week date := public.league_week_start(current_date);
  _prev_week date := _this_week - 7;
  _my_div text;
  _atype text := coalesce(_activity_type, '');
BEGIN
  IF _uid IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.user_league_divisions (user_id, activity_type, division)
  VALUES (_uid, _atype, 'bronze')
  ON CONFLICT (user_id, activity_type) DO NOTHING;

  PERFORM public.process_league_rollover(_prev_week, _atype);

  SELECT d.division INTO _my_div
  FROM public.user_league_divisions d
  WHERE d.user_id = _uid AND d.activity_type = _atype;

  RETURN QUERY
  WITH week_pts AS (
    SELECT ua.user_id,
           SUM(public.league_points_expr(ua.distance_meters, ua.elevation_gain))::int AS pts
    FROM public.user_activities ua
    WHERE ua.status = 'completed'
      AND (ua.start_time AT TIME ZONE 'America/Sao_Paulo')::date >= _this_week
      AND (ua.start_time AT TIME ZONE 'America/Sao_Paulo')::date <  _this_week + 7
      AND (_atype = '' OR ua.activity_type = _atype)
    GROUP BY ua.user_id
  )
  SELECT p.id, p.full_name, p.username, p.avatar_url,
         coalesce(wp.pts, 0) AS points,
         d.division,
         (p.id = _uid) AS is_me
  FROM public.user_league_divisions d
  JOIN public.profiles p ON p.id = d.user_id
  LEFT JOIN week_pts wp ON wp.user_id = d.user_id
  WHERE d.activity_type = _atype
    AND d.division = _my_div
  ORDER BY coalesce(wp.pts, 0) DESC, p.id
  LIMIT greatest(1, least(coalesce(_limit, 50), 200));
END;
$$;
REVOKE ALL ON FUNCTION public.fetch_league_standings(text, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.fetch_league_standings(text, integer) TO authenticated;
