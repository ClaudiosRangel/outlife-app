-- 20260927110000_fix-league-standings-ambiguous2.sql
-- Correção definitiva do "column reference user_id is ambiguous": o problema é
-- que as colunas de saída do RETURNS TABLE (user_id, division) colidem com as
-- colunas das tabelas dentro do corpo (INSERT ... ON CONFLICT (user_id,...),
-- que NÃO aceita alias). Solução: renomear as OUT columns com prefixo `o_` e
-- devolver via RETURN QUERY com apelidos corretos. O PostgREST/Supabase expõe
-- os nomes das OUT columns tal como declarados, então o cliente passará a
-- receber o_user_id/o_points/etc. — por isso a API (league.ts) também é
-- ajustada no mesmo commit para mapear esses nomes.
-- Idempotente. DROP+CREATE porque a assinatura de retorno muda.

DROP FUNCTION IF EXISTS public.fetch_league_standings(text, integer);

CREATE FUNCTION public.fetch_league_standings(
  _activity_type text DEFAULT NULL,
  _limit integer DEFAULT 50
) RETURNS TABLE (
  o_user_id uuid,
  o_full_name text,
  o_username text,
  o_avatar_url text,
  o_points integer,
  o_division text,
  o_is_me boolean
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
  SELECT p.id,
         p.full_name,
         p.username,
         p.avatar_url,
         coalesce(wp.pts, 0),
         uld.division,
         (p.id = _uid)
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
