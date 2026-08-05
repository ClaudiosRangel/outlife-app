-- Adiciona Activity_Type e Activity_Map_Snapshot a User_Activity
-- (Requirements 4.3, 6.1 do spec app-hibrido-nativo).
--
-- `activity_type` classifica o esforço físico da atividade (Caminhada,
-- Pedalada, Trilha ou Outro) e é selecionado pelo usuário antes de iniciar
-- o rastreamento (Requirement 4.1/4.2) — por isso também é gravado no
-- INSERT feito por `startActivity`, não apenas ao finalizar.
-- `map_snapshot_url` armazena a URL do Activity_Map_Snapshot gerado ao
-- finalizar a atividade (Requirement 6.1).
--
-- Segue o mesmo padrão incremental já usado em
-- `20260719090000_activity-description-and-image.sql`: colunas simples
-- opcionais, e `finish_user_activity` estendida com parâmetros opcionais
-- no final da assinatura, preservando compatibilidade com chamadores que
-- não os informem.

ALTER TABLE public.user_activities
  ADD COLUMN IF NOT EXISTS activity_type TEXT,
  ADD COLUMN IF NOT EXISTS map_snapshot_url TEXT;

ALTER TABLE public.user_activities
  DROP CONSTRAINT IF EXISTS user_activities_activity_type_check;

ALTER TABLE public.user_activities
  ADD CONSTRAINT user_activities_activity_type_check
  CHECK (activity_type IS NULL OR activity_type IN ('caminhada', 'pedalada', 'trilha', 'outro'));

CREATE OR REPLACE FUNCTION public.finish_user_activity(
  _id UUID,
  _geojson JSONB,
  _distance NUMERIC,
  _duration INTEGER,
  _description TEXT DEFAULT NULL,
  _image_url TEXT DEFAULT NULL,
  _activity_type TEXT DEFAULT NULL,
  _map_snapshot_url TEXT DEFAULT NULL
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
        description = COALESCE(_description, description),
        image_url = COALESCE(_image_url, image_url),
        activity_type = COALESCE(_activity_type, activity_type),
        map_snapshot_url = COALESCE(_map_snapshot_url, map_snapshot_url),
        end_time = now(),
        status = 'completed'
    WHERE id = _id AND user_id = auth.uid()
    RETURNING * INTO result;
  RETURN result;
END;
$$;
