-- 20260926140000_league-weekly.sql
-- Ligas semanais (Bloco 2): divisões Bronze→Prata→Ouro→Diamante por tipo de
-- atividade, com promoção/rebaixamento ao virar a semana. Os PONTOS e o
-- ranking da semana são DERIVADOS das atividades concluídas (não persistidos);
-- só a DIVISÃO do usuário é estado, evoluído por rollover idempotente.
-- Semana: segunda→domingo, fuso America/Sao_Paulo.
-- Idempotente: CREATE TABLE/INDEX IF NOT EXISTS + CREATE OR REPLACE FUNCTION.

-- ============ TABELAS ============
CREATE TABLE IF NOT EXISTS public.user_league_divisions (
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_type text,                       -- NULL = liga "geral" (todos os tipos)
  division      text NOT NULL DEFAULT 'bronze'
                CHECK (division IN ('bronze','prata','ouro','diamante')),
  updated_week  date,                       -- 2ª-feira da semana do último rollover aplicado
  PRIMARY KEY (user_id, activity_type)
);

-- activity_type NULL faz parte da PK; Postgres trata NULLs como distintos em
-- UNIQUE, então garantimos unicidade da linha "geral" com índice parcial.
CREATE UNIQUE INDEX IF NOT EXISTS user_league_divisions_geral_uidx
  ON public.user_league_divisions (user_id)
  WHERE activity_type IS NULL;

ALTER TABLE public.user_league_divisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own league division select" ON public.user_league_divisions;
CREATE POLICY "own league division select"
  ON public.user_league_divisions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
-- Sem policy de escrita: só via RPC SECURITY DEFINER.

CREATE TABLE IF NOT EXISTS public.league_rollover_log (
  week_start    date NOT NULL,
  activity_type text,
  processed_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (week_start, activity_type)
);
-- Índice parcial para a variante "geral" (activity_type NULL) na PK composta.
CREATE UNIQUE INDEX IF NOT EXISTS league_rollover_log_geral_uidx
  ON public.league_rollover_log (week_start)
  WHERE activity_type IS NULL;

ALTER TABLE public.league_rollover_log ENABLE ROW LEVEL SECURITY;
-- Nenhuma policy: cliente não acessa; só as RPCs SECURITY DEFINER.

-- ============ PONTUAÇÃO (expressão pura) ============
-- 1 ponto por 100m + 1 ponto por metro de elevação. Espelha src/lib/league-points.ts.
CREATE OR REPLACE FUNCTION public.league_points_expr(_distance numeric, _elev numeric)
RETURNS integer
LANGUAGE sql IMMUTABLE
AS $$
  SELECT round(GREATEST(coalesce(_distance,0),0) / 100.0)::int
       + round(GREATEST(coalesce(_elev,0),0))::int;
$$;

-- 2ª-feira (início da semana) de uma data no fuso Brasília.
CREATE OR REPLACE FUNCTION public.league_week_start(_d date)
RETURNS date
LANGUAGE sql IMMUTABLE
AS $$
  SELECT (date_trunc('week', _d::timestamp))::date;  -- date_trunc('week') = segunda
$$;

-- ============ ROLLOVER (idempotente) ============
-- Processa a promoção/rebaixamento de uma semana FECHADA para um tipo.
-- Top 3 sobem (exceto diamante); bottom 3 descem SOMENTE se a divisão tiver
-- >= 8 participantes ativos (não pune divisão pequena / quem entrou agora).
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
BEGIN
  -- Trava de idempotência: se já processado, sai.
  BEGIN
    INSERT INTO public.league_rollover_log (week_start, activity_type)
    VALUES (_week_start, _activity_type);
  EXCEPTION WHEN unique_violation THEN
    RETURN;
  END;

  -- Para cada divisão, ranqueia os participantes pelos pontos da semana FECHADA
  -- (só do tipo, ou geral quando NULL) e aplica promoção/rebaixamento — tudo
  -- num único CTE (sem TEMP TABLE, evitando colisão em chamadas encadeadas).
  WITH week_pts AS (
    SELECT ua.user_id,
           SUM(public.league_points_expr(ua.distance_meters, ua.elevation_gain)) AS pts
    FROM public.user_activities ua
    WHERE ua.status = 'completed'
      AND (ua.start_time AT TIME ZONE 'America/Sao_Paulo')::date >= _week_start
      AND (ua.start_time AT TIME ZONE 'America/Sao_Paulo')::date <  _week_start + 7
      AND (_activity_type IS NULL OR ua.activity_type = _activity_type)
    GROUP BY ua.user_id
  ),
  ranked AS (
    SELECT d.user_id, d.division, coalesce(w.pts,0) AS pts,
           ROW_NUMBER() OVER (PARTITION BY d.division ORDER BY coalesce(w.pts,0) DESC, d.user_id) AS rn_top,
           ROW_NUMBER() OVER (PARTITION BY d.division ORDER BY coalesce(w.pts,0) ASC, d.user_id) AS rn_bot,
           COUNT(*) FILTER (WHERE coalesce(w.pts,0) > 0) OVER (PARTITION BY d.division) AS active_in_div
    FROM public.user_league_divisions d
    LEFT JOIN week_pts w ON w.user_id = d.user_id
    WHERE d.activity_type IS NOT DISTINCT FROM _activity_type
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
     AND d.activity_type IS NOT DISTINCT FROM _activity_type
     AND m.new_division <> d.division;
END;
$$;
REVOKE ALL ON FUNCTION public.process_league_rollover(date, text) FROM public;
GRANT EXECUTE ON FUNCTION public.process_league_rollover(date, text) TO authenticated;

-- ============ STANDINGS (leitura) ============
-- Para o auth.uid(): garante a divisão (bronze se ausente), roda rollover de
-- semanas fechadas pendentes, e retorna os participantes da MINHA divisão na
-- semana corrente, ordenados por pontos.
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
BEGIN
  IF _uid IS NULL THEN
    RETURN;
  END IF;

  -- Garante a linha de divisão do solicitante (default bronze).
  INSERT INTO public.user_league_divisions (user_id, activity_type, division)
  VALUES (_uid, _activity_type, 'bronze')
  ON CONFLICT (user_id, activity_type) DO NOTHING;

  -- Rollover da semana anterior (idempotente). Só roda uma vez por semana/tipo.
  PERFORM public.process_league_rollover(_prev_week, _activity_type);

  SELECT d.division INTO _my_div
  FROM public.user_league_divisions d
  WHERE d.user_id = _uid AND d.activity_type IS NOT DISTINCT FROM _activity_type;

  RETURN QUERY
  WITH week_pts AS (
    SELECT ua.user_id,
           SUM(public.league_points_expr(ua.distance_meters, ua.elevation_gain))::int AS pts
    FROM public.user_activities ua
    WHERE ua.status = 'completed'
      AND (ua.start_time AT TIME ZONE 'America/Sao_Paulo')::date >= _this_week
      AND (ua.start_time AT TIME ZONE 'America/Sao_Paulo')::date <  _this_week + 7
      AND (_activity_type IS NULL OR ua.activity_type = _activity_type)
    GROUP BY ua.user_id
  )
  SELECT p.id, p.full_name, p.username, p.avatar_url,
         coalesce(wp.pts, 0) AS points,
         d.division,
         (p.id = _uid) AS is_me
  FROM public.user_league_divisions d
  JOIN public.profiles p ON p.id = d.user_id
  LEFT JOIN week_pts wp ON wp.user_id = d.user_id
  WHERE d.activity_type IS NOT DISTINCT FROM _activity_type
    AND d.division = _my_div
  ORDER BY coalesce(wp.pts, 0) DESC, p.id
  LIMIT greatest(1, least(coalesce(_limit, 50), 200));
END;
$$;
REVOKE ALL ON FUNCTION public.fetch_league_standings(text, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.fetch_league_standings(text, integer) TO authenticated;
