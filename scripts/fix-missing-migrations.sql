-- Script consolidado e IDEMPOTENTE das migrations 20260719090000 a
-- 20260721030000, que corrigem o erro "could not find the activity_type
-- column of user_activities in the schema cache" e trazem outras
-- alterações da mesma leva de trabalho que também podem não ter sido
-- aplicadas em produção.
--
-- Seguro para rodar mesmo que parte já exista: colunas usam
-- ADD COLUMN IF NOT EXISTS, tabelas usam CREATE TABLE IF NOT EXISTS, e
-- policies são criadas dentro de blocos DO que verificam
-- pg_policies antes de criar (evita erro "policy already exists").
--
-- Rodar no SQL Editor do Supabase Dashboard (projeto dxmbftbhmjjqtpjymakj),
-- de uma vez, colando o conteúdo completo.

-- ============================================================
-- 20260719090000_activity-description-and-image
-- ============================================================
ALTER TABLE public.user_activities
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('activity-images', 'activity-images', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Activity images are public readable') THEN
    CREATE POLICY "Activity images are public readable"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'activity-images');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Owners can upload to their activity images folder') THEN
    CREATE POLICY "Owners can upload to their activity images folder"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'activity-images' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Owners can update their activity images') THEN
    CREATE POLICY "Owners can update their activity images"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'activity-images' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Owners can delete their activity images') THEN
    CREATE POLICY "Owners can delete their activity images"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'activity-images' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

-- ============================================================
-- 20260720090000_community-post-category
-- ============================================================
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'outro';

ALTER TABLE public.community_posts
  DROP CONSTRAINT IF EXISTS community_posts_category_check;

ALTER TABLE public.community_posts
  ADD CONSTRAINT community_posts_category_check
  CHECK (category IN ('trilha', 'camping', 'relato', 'outro'));

CREATE INDEX IF NOT EXISTS idx_community_posts_category ON public.community_posts(category);

-- ============================================================
-- 20260721000000_activity-type-and-map-snapshot
-- (correção principal do erro relatado)
-- ============================================================
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

-- ============================================================
-- 20260721010000_community-post-category-pedalada-caminhada
-- ============================================================
ALTER TABLE public.community_posts
  DROP CONSTRAINT IF EXISTS community_posts_category_check;

ALTER TABLE public.community_posts
  ADD CONSTRAINT community_posts_category_check
  CHECK (category IN ('trilha', 'camping', 'relato', 'outro', 'pedalada', 'caminhada'));

-- ============================================================
-- 20260721020000_native-and-web-push-tokens
-- ============================================================
CREATE TABLE IF NOT EXISTS public.native_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios')),
  device_id TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)
);

ALTER TABLE public.native_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.web_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

ALTER TABLE public.web_push_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'native_push_tokens' AND policyname = 'Users manage their own native push tokens') THEN
    CREATE POLICY "Users manage their own native push tokens"
      ON public.native_push_tokens FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'web_push_subscriptions' AND policyname = 'Users manage their own web push subscriptions') THEN
    CREATE POLICY "Users manage their own web push subscriptions"
      ON public.web_push_subscriptions FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 20260721030000_fn-dispatch-push-notification
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_send_native_push(
  _token TEXT,
  _platform TEXT,
  _type TEXT,
  _payload JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE NOTICE 'fn_send_native_push: platform=%, type=%', _platform, _type;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_send_web_push(
  _endpoint TEXT,
  _p256dh TEXT,
  _auth TEXT,
  _type TEXT,
  _payload JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE NOTICE 'fn_send_web_push: type=%', _type;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_dispatch_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  token_row RECORD;
  sub_row RECORD;
BEGIN
  FOR token_row IN
    SELECT token, platform FROM public.native_push_tokens
    WHERE user_id = NEW.recipient_id AND is_active
  LOOP
    BEGIN
      PERFORM public.fn_send_native_push(token_row.token, token_row.platform, NEW.type, to_jsonb(NEW));
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  FOR sub_row IN
    SELECT endpoint, p256dh, auth FROM public.web_push_subscriptions
    WHERE user_id = NEW.recipient_id AND is_active
  LOOP
    BEGIN
      PERFORM public.fn_send_web_push(sub_row.endpoint, sub_row.p256dh, sub_row.auth, NEW.type, to_jsonb(NEW));
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dispatch_push_notification ON public.notifications;

CREATE TRIGGER trg_dispatch_push_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.fn_dispatch_push_notification();

-- ============================================================
-- Recarrega o schema cache do PostgREST (resolve o erro "could not find
-- the X column ... in the schema cache" imediatamente, sem esperar o
-- Supabase detectar a mudança sozinho).
-- ============================================================
NOTIFY pgrst, 'reload schema';
