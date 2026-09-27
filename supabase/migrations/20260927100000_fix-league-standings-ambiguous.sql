-- 20260927100000_fix-league-standings-ambiguous.sql
-- BUG: fetch_league_standings dava "column reference \"user_id\" is ambiguous"
-- porque o RETURNS TABLE declara `user_id` e isso colide com a coluna user_id
-- usada no INSERT ... ON CONFLICT (user_id, activity_type) e nos SELECTs.
-- Só aparecia com auth.uid() presente (chega no INSERT). Correção: qualificar
-- todas as colunas e usar `SET LOCAL` de nada — apenas prefixar tabelas.
-- Idempotente (CREATE OR REPLACE).

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

  -- Garante a linha de divisão do solicitante (colunas qualificadas p/ evitar
  -- ambiguidade com as OUT columns user_id/division).
  INSERT INTO public.user_league_divisions AS uld (user_id, activity_type, division)
  VALUES (_uid, _atype, 'bronze')
  ON CONFLICT (user_id, activity_type) DO NOTHING;

  PERFORM public.process_league_rollover(_prev_week, _atype);

  SELECT uld.division INTO _my_div
  FROM public.user_league_divisions uld
  WHERE uld.user_id = _uid AND uld.activity_type = _atype;

  RETURN QUERY
  WITH week_pts AS (
    SELECT ua.user_id AS uid,
           SUM(public.league_points_expr(ua.distance_meters, ua.elevation_gain))::int AS pts
    FROM public.user_activities ua
    WHERE ua.status = 'completed'
      AND (ua.start_time AT TIME ZONE 'America/Sao_Paulo')::date >= _this_week
      AND (ua.start_time AT TIME ZONE 'America/Sao_Paulo')::date <  _this_week + 7
      AND (_atype = '' OR ua.activity_type = _atype)
    GROUP BY ua.user_id
  )
  SELECT p.id AS user_id,
         p.full_name,
         p.username,
         p.avatar_url,
         coalesce(wp.pts, 0) AS points,
         uld.division AS division,
         (p.id = _uid) AS is_me
  FROM public.user_league_divisions uld
  JOIN public.profiles p ON p.id = uld.user_id
  LEFT JOIN week_pts wp ON wp.uid = uld.user_id
  WHERE uld.activity_type = _atype
    AND uld.division = _my_div
  ORDER BY coalesce(wp.pts, 0) DESC, p.id
  LIMIT greatest(1, least(coalesce(_limit, 50), 200));
END;
$$;
REVOKE ALL ON FUNCTION public.fetch_league_standings(text, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.fetch_league_standings(text, integer) TO authenticated;
