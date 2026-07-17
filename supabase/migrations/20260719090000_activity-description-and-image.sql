-- Adiciona descrição e foto opcionais a User_Activity, coletadas ao
-- finalizar o rastreamento em `/atividade/rastrear` (Requirement solicitado
-- pelo usuário: "quando finalizar... dar opção de uma descrição e uma
-- imagem").
--
-- Segue o mesmo padrão já usado por `community_posts.image_url`/
-- `post_comments`: colunas simples opcionais, sem tabela nova. A RPC
-- `finish_user_activity` (SECURITY INVOKER, RLS de `user_activities` já
-- restringe a linha ao próprio `user_id`) é estendida com dois parâmetros
-- opcionais no final da assinatura (`_description`, `_image_url`), mantendo
-- compatibilidade com qualquer chamador antigo que não os informe.

ALTER TABLE public.user_activities
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT;

CREATE OR REPLACE FUNCTION public.finish_user_activity(
  _id UUID,
  _geojson JSONB,
  _distance NUMERIC,
  _duration INTEGER,
  _description TEXT DEFAULT NULL,
  _image_url TEXT DEFAULT NULL
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
        end_time = now(),
        status = 'completed'
    WHERE id = _id AND user_id = auth.uid()
    RETURNING * INTO result;
  RETURN result;
END;
$$;

-- Bucket para as fotos anexadas a User_Activity, mesmo padrão de
-- `avatars`/`community-post-images` (público, pois a foto pode aparecer em
-- telas compartilháveis de atividade; policies restritas à pasta do
-- próprio usuário).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('activity-images', 'activity-images', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Activity images are public readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'activity-images');

CREATE POLICY "Owners can upload to their activity images folder"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'activity-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners can update their activity images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'activity-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners can delete their activity images"
ON storage.objects FOR DELETE
USING (bucket_id = 'activity-images' AND auth.uid()::text = (storage.foldername(name))[1]);
