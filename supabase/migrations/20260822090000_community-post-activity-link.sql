-- 20260822090000_community-post-activity-link.sql
-- Vincula o post da comunidade gerado ao finalizar uma atividade à própria
-- User_Activity, para permitir que tocar no post leve ao detalhe da
-- atividade (/atividade/:id) e que o compartilhamento inclua o deep link.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE FUNCTION.
-- NUNCA editar migrations já aplicadas — arquivo novo, posterior a
-- 20260821090000_live-activity-friends-view.sql.

-- 1) Coluna de vínculo opcional (nullable): posts que NÃO vêm de atividade
--    (posts manuais da comunidade) permanecem com activity_id NULL.
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS activity_id UUID REFERENCES public.user_activities(id) ON DELETE SET NULL;

-- 2) finish_user_activity: mesma definição de 9 args já vigente, agora
--    gravando activity_id = result.id no INSERT do post da comunidade.
--    Só esse INSERT muda; todo o restante é idêntico à versão atual.
CREATE OR REPLACE FUNCTION public.finish_user_activity(
  _id UUID,
  _geojson JSONB,
  _distance NUMERIC,
  _duration INTEGER,
  _description TEXT DEFAULT NULL,
  _image_url TEXT DEFAULT NULL,
  _activity_type TEXT DEFAULT NULL,
  _map_snapshot_url TEXT DEFAULT NULL,
  _elevation_gain NUMERIC DEFAULT NULL
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
        elevation_gain = COALESCE(_elevation_gain, elevation_gain),
        end_time = now(),
        status = 'completed'
    WHERE id = _id AND user_id = auth.uid()
    RETURNING * INTO result;

  -- Req 4: publica automaticamente na comunidade (isolado — falha não
  -- reverte a atividade já concluída). Agora com activity_id = result.id
  -- para permitir navegação/compartilhamento a partir do post.
  BEGIN
    INSERT INTO public.community_posts (author_id, text, category, image_url, activity_id)
    VALUES (
      result.user_id,
      public.fn_build_activity_post_text(result),
      public.fn_map_activity_type_to_category(result.activity_type),
      result.map_snapshot_url,
      result.id
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Req 5: notifica amigos accepted (SECURITY DEFINER, isolado).
  BEGIN
    PERFORM public.fn_notify_activity_completed(result);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN result;
END;
$$;
