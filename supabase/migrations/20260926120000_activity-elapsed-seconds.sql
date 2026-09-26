-- 20260926120000_activity-elapsed-seconds.sql
-- Tempo TOTAL da atividade (Elapsed_Time): do início ao fim, contando todas as
-- paradas (pausa manual e auto-pausa). Distinto do `duration_seconds`, que é o
-- Tempo em Movimento (congela nas paradas). Spec: atividade-tempo-movimento.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE FUNCTION.
-- NUNCA editar migrations já aplicadas — arquivo novo, posterior a
-- 20260908120500_finish-activity-video.sql (fonte atual da RPC).

-- 1) Coluna nullable: atividades anteriores ficam com NULL (retrocompat).
ALTER TABLE public.user_activities
  ADD COLUMN IF NOT EXISTS elapsed_seconds INTEGER;

-- 2) finish_user_activity com _elapsed (11 args). DEFAULT NULL preserva
--    compatibilidade com chamadas de 10 args. Só grava elapsed_seconds a mais.
CREATE OR REPLACE FUNCTION public.finish_user_activity(
  _id UUID,
  _geojson JSONB,
  _distance NUMERIC,
  _duration INTEGER,
  _description TEXT DEFAULT NULL,
  _image_url TEXT DEFAULT NULL,
  _activity_type TEXT DEFAULT NULL,
  _map_snapshot_url TEXT DEFAULT NULL,
  _elevation_gain NUMERIC DEFAULT NULL,
  _video_url TEXT DEFAULT NULL,
  _elapsed INTEGER DEFAULT NULL
) RETURNS public.user_activities
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  result public.user_activities;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    PERFORM public.fn_check_rate_limit(auth.uid(), 'finish_user_activity', 20, 3600);
  END IF;

  UPDATE public.user_activities
    SET route_geojson = _geojson,
        route = ST_GeogFromText(ST_AsText(ST_GeomFromGeoJSON(_geojson::text))),
        distance_meters = _distance,
        duration_seconds = _duration,
        elapsed_seconds = COALESCE(_elapsed, elapsed_seconds),
        description = COALESCE(_description, description),
        image_url = COALESCE(_image_url, image_url),
        activity_type = COALESCE(_activity_type, activity_type),
        map_snapshot_url = COALESCE(_map_snapshot_url, map_snapshot_url),
        elevation_gain = COALESCE(_elevation_gain, elevation_gain),
        video_url = COALESCE(_video_url, video_url),
        end_time = now(),
        status = 'completed'
    WHERE id = _id AND user_id = auth.uid()
    RETURNING * INTO result;

  BEGIN
    INSERT INTO public.community_posts (author_id, text, category, image_url, video_url, activity_id)
    VALUES (
      result.user_id,
      public.fn_build_activity_post_text(result),
      public.fn_map_activity_type_to_category(result.activity_type),
      result.map_snapshot_url,
      result.video_url,
      result.id
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    PERFORM public.fn_notify_activity_completed(result);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN result;
END;
$$;
