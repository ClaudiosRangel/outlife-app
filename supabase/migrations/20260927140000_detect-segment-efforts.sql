-- 20260927140000_detect-segment-efforts.sql
-- Detecção de esforços de segmento no SERVIDOR (retroativa) usando PostGIS.
-- Motivo: a detecção no cliente (matchSegmentEffort) só roda no FINISH da
-- atividade. Segmentos criados DEPOIS de uma atividade (o caso comum: "criei um
-- segmento a partir da minha pedalada de hoje") nunca geravam esforço — o
-- ranking ficava vazio e o KOM não aparecia nem para o autor. Aqui cruzamos a
-- geometria já persistida da atividade (route_geog) com o início/fim do
-- segmento; quando ambos são atingidos e o comprimento é compatível, gravamos
-- o esforço usando a duração da atividade como tempo (melhor aproximação sem
-- timestamps por ponto no banco). Idempotente (não duplica esforço já gravado).

CREATE OR REPLACE FUNCTION public.detect_segment_efforts(
  _segment_id uuid,
  _radius_m double precision DEFAULT 60,     -- tolerância das pontas (m)
  _dist_tol double precision DEFAULT 0.35    -- tolerância relativa de comprimento
) RETURNS int
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _seg RECORD;
  _start geography;
  _end geography;
  _inserted int := 0;
  _rec RECORD;
BEGIN
  SELECT id, activity_type, distance_meters, start_lat, start_lng, end_lat, end_lng
    INTO _seg
  FROM public.segments WHERE id = _segment_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF _seg.start_lat IS NULL OR _seg.end_lat IS NULL THEN RETURN 0; END IF;

  _start := ST_SetSRID(ST_MakePoint(_seg.start_lng::float8, _seg.start_lat::float8), 4326)::geography;
  _end   := ST_SetSRID(ST_MakePoint(_seg.end_lng::float8,   _seg.end_lat::float8),   4326)::geography;

  FOR _rec IN
    SELECT a.id AS activity_id, a.user_id, a.duration_seconds, a.route
    FROM public.user_activities a
    WHERE a.status = 'completed'
      AND a.route IS NOT NULL
      AND a.duration_seconds IS NOT NULL
      AND a.duration_seconds > 0
      -- mesmo tipo do segmento (segmento sem tipo aceita qualquer)
      AND (_seg.activity_type IS NULL OR a.activity_type = _seg.activity_type)
      -- a rota passa perto do início E do fim do segmento
      AND ST_DWithin(a.route, _start, _radius_m)
      AND ST_DWithin(a.route, _end, _radius_m)
      -- comprimento da rota compatível com o do segmento (evita falso positivo)
      AND (
        _seg.distance_meters <= 0
        OR ST_Length(a.route) BETWEEN _seg.distance_meters * (1 - _dist_tol)
                                  AND _seg.distance_meters * (1 + _dist_tol)
      )
  LOOP
    -- idempotência: um esforço por (segmento, atividade)
    IF NOT EXISTS (
      SELECT 1 FROM public.segment_efforts se
      WHERE se.segment_id = _segment_id AND se.activity_id = _rec.activity_id
    ) THEN
      INSERT INTO public.segment_efforts (segment_id, user_id, activity_id, elapsed_seconds)
      VALUES (_segment_id, _rec.user_id, _rec.activity_id, _rec.duration_seconds);
      _inserted := _inserted + 1;
    END IF;
  END LOOP;

  RETURN _inserted;
END;
$$;
REVOKE ALL ON FUNCTION public.detect_segment_efforts(uuid, double precision, double precision) FROM public;
GRANT EXECUTE ON FUNCTION public.detect_segment_efforts(uuid, double precision, double precision) TO authenticated;
