
CREATE TABLE public.user_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  destination_id UUID REFERENCES public.destinations(id) ON DELETE SET NULL,
  start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_time TIMESTAMPTZ,
  duration_seconds INTEGER,
  distance_meters NUMERIC,
  route GEOGRAPHY(LineString, 4326),
  route_geojson JSONB,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX user_activities_user_start_idx
  ON public.user_activities (user_id, start_time DESC);

ALTER TABLE public.user_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own activities"
  ON public.user_activities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own activities"
  ON public.user_activities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activities"
  ON public.user_activities FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own activities"
  ON public.user_activities FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER user_activities_set_updated_at
  BEFORE UPDATE ON public.user_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.finish_user_activity(
  _id UUID,
  _geojson JSONB,
  _distance NUMERIC,
  _duration INTEGER
) RETURNS public.user_activities
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  result public.user_activities;
BEGIN
  UPDATE public.user_activities
    SET route_geojson = _geojson,
        route = ST_GeogFromText(ST_AsText(ST_GeomFromGeoJSON(_geojson::text))),
        distance_meters = _distance,
        duration_seconds = _duration,
        end_time = now(),
        status = 'completed'
    WHERE id = _id AND user_id = auth.uid()
    RETURNING * INTO result;
  RETURN result;
END;
$$;
