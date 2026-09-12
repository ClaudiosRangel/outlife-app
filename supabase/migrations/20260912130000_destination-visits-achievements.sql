-- ============================================================================
-- Frente G (spec evolucao-admin-atividades-social) — Conquistas por Destino
-- via GPS. Tabela user_destination_visits + RPCs register_destination_visits
-- e grant_destination_achievements. Idempotente.
-- ============================================================================

-- 1) Visitas a destino (1 destino distinto por usuário via UNIQUE).
CREATE TABLE IF NOT EXISTS public.user_destination_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  destination_id UUID NOT NULL REFERENCES public.destinations(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES public.user_activities(id) ON DELETE SET NULL,
  visited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, destination_id)
);
CREATE INDEX IF NOT EXISTS user_destination_visits_user_idx
  ON public.user_destination_visits(user_id);

ALTER TABLE public.user_destination_visits ENABLE ROW LEVEL SECURITY;

-- Leitura só das próprias visitas; escrita apenas via RPC SECURITY DEFINER
-- (nenhuma policy de INSERT/UPDATE/DELETE para o cliente).
DROP POLICY IF EXISTS "read own visits" ON public.user_destination_visits;
CREATE POLICY "read own visits" ON public.user_destination_visits FOR SELECT
  USING (auth.uid() = user_id);

-- 2) grant_destination_achievements: conta destinos distintos visitados e
--    concede as conquistas atingidas (destinos_1/5/10), idempotente por
--    UNIQUE(user_id, rule_code) de achievement_records.
CREATE OR REPLACE FUNCTION public.grant_destination_achievements(_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _count integer;
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;

  SELECT COUNT(*) INTO _count
  FROM public.user_destination_visits
  WHERE user_id = _user_id;

  IF _count >= 1 THEN
    INSERT INTO public.achievement_records (user_id, rule_code)
    VALUES (_user_id, 'destinos_1')
    ON CONFLICT (user_id, rule_code) DO NOTHING;
  END IF;
  IF _count >= 5 THEN
    INSERT INTO public.achievement_records (user_id, rule_code)
    VALUES (_user_id, 'destinos_5')
    ON CONFLICT (user_id, rule_code) DO NOTHING;
  END IF;
  IF _count >= 10 THEN
    INSERT INTO public.achievement_records (user_id, rule_code)
    VALUES (_user_id, 'destinos_10')
    ON CONFLICT (user_id, rule_code) DO NOTHING;
  END IF;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.grant_destination_achievements(uuid) TO authenticated;

-- 3) register_destination_visits: cruza a rota (route_geojson) de uma
--    atividade concluída do próprio usuário com os destinos aprovados dentro
--    de um raio (default 500 m), grava as visitas (idempotente via UNIQUE) e
--    concede as conquistas.
CREATE OR REPLACE FUNCTION public.register_destination_visits(
  _activity_id uuid, _radius_meters double precision DEFAULT 500
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _owner uuid;
  _geojson jsonb;
  _route geography;
  _inserted integer := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT user_id, route_geojson::jsonb
    INTO _owner, _geojson
  FROM public.user_activities
  WHERE id = _activity_id AND status = 'completed';

  -- Só o dono registra visitas da própria atividade.
  IF _owner IS NULL OR _owner <> _uid THEN RETURN 0; END IF;
  IF _geojson IS NULL OR _geojson->>'type' <> 'LineString' THEN RETURN 0; END IF;

  -- Constrói a geografia da rota a partir do GeoJSON (SRID 4326).
  _route := ST_SetSRID(ST_GeomFromGeoJSON(_geojson::text), 4326)::geography;

  WITH nearby AS (
    SELECT d.id
    FROM public.destinations d
    WHERE d.status = 'approved'
      AND d.geog IS NOT NULL
      AND ST_DWithin(d.geog, _route, GREATEST(0, _radius_meters))
  ), ins AS (
    INSERT INTO public.user_destination_visits (user_id, destination_id, activity_id)
    SELECT _uid, n.id, _activity_id FROM nearby n
    ON CONFLICT (user_id, destination_id) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO _inserted FROM ins;

  PERFORM public.grant_destination_achievements(_uid);
  RETURN _inserted;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.register_destination_visits(uuid, double precision) TO authenticated;
