-- ============================================================================
-- OutVitar — MIGRAÇÕES PENDENTES CONSOLIDADAS (aplicar no Supabase)
-- ============================================================================
--
-- COMO USAR (SQL Editor do dashboard Supabase):
--   1. Abra o projeto em https://supabase.com → SQL Editor → New query.
--   2. Cole TODO este arquivo e clique em "Run".
--   3. Todas as instruções são IDEMPOTENTES (IF NOT EXISTS / CREATE OR REPLACE
--      / DROP ... IF EXISTS). Rodar mais de uma vez NÃO quebra nem duplica.
--
-- Este arquivo consolida, na ordem cronológica correta, as migrações dos
-- blocos que ainda não foram aplicadas em produção:
--   1) 20260820090000_activity-elevation-and-finish-effects  (elevação + efeitos)
--   2) 20260821090000_live-activity-friends-view             (amigos ao vivo)
--   3) 20260822090000_community-post-activity-link           (post↔atividade)
--   4) 20260908120000_community-post-video                   (Bloco D — vídeo)
--   5) 20260908120500_finish-activity-video                  (Bloco D — vídeo)
--   6) 20260908130000_gamificacao-niveis-rank                (Bloco E — níveis/rank)
--   7) 20260908140000_cadastros-completos                    (Bloco F — cadastros)
--
-- OBS.: se alguma das 3 primeiras (elevação/amigos ao vivo/activity-link) já
-- tiver sido aplicada manualmente antes, tudo bem — a idempotência garante que
-- reaplicar não causa erro. A versão FINAL de `finish_user_activity` (com
-- _video_url) é a do item 5; as versões anteriores da função são recriadas no
-- caminho e substituídas — o resultado final é sempre a de 10 argumentos.
--
-- Gerado automaticamente a partir de supabase/migrations/*.sql.
-- ============================================================================


-- ############################################################################
-- 1) 20260820090000_activity-elevation-and-finish-effects.sql
-- ############################################################################

ALTER TABLE public.user_activities
  ADD COLUMN IF NOT EXISTS elevation_gain NUMERIC;

CREATE OR REPLACE FUNCTION public.fn_map_activity_type_to_category(_type TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _type
    WHEN 'caminhada' THEN 'caminhada'
    WHEN 'pedalada'  THEN 'pedalada'
    WHEN 'trilha'    THEN 'trilha'
    WHEN 'outro'     THEN 'outro'
    ELSE 'outro'
  END;
$$;

CREATE OR REPLACE FUNCTION public.fn_build_activity_post_text(_a public.user_activities)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_metros    NUMERIC := COALESCE(_a.distance_meters, 0);
  v_segundos  INTEGER := COALESCE(_a.duration_seconds, 0);
  v_horas     INTEGER;
  v_min       INTEGER;
  v_seg       INTEGER;
  v_distancia TEXT;
  v_duracao   TEXT;
  v_substantivo TEXT;
  v_descricao TEXT;
  v_texto     TEXT;
BEGIN
  IF v_metros >= 1000 THEN
    v_distancia := to_char(round(v_metros / 1000.0, 1), 'FM990.0') || ' km';
  ELSE
    v_distancia := round(GREATEST(v_metros, 0))::INTEGER::TEXT || ' m';
  END IF;

  IF v_segundos < 0 THEN
    v_segundos := 0;
  END IF;
  v_horas := v_segundos / 3600;
  v_min   := (v_segundos % 3600) / 60;
  v_seg   := v_segundos % 60;
  IF v_horas > 0 THEN
    v_duracao := v_horas::TEXT || ':' || lpad(v_min::TEXT, 2, '0') || ':' || lpad(v_seg::TEXT, 2, '0');
  ELSE
    v_duracao := lpad(v_min::TEXT, 2, '0') || ':' || lpad(v_seg::TEXT, 2, '0');
  END IF;

  v_substantivo := CASE _a.activity_type
    WHEN 'caminhada' THEN 'uma caminhada'
    WHEN 'pedalada'  THEN 'uma pedalada'
    WHEN 'trilha'    THEN 'uma trilha'
    ELSE 'uma atividade'
  END;

  v_texto := 'Concluí ' || v_substantivo || ' de ' || v_distancia || ' em ' || v_duracao || '.';

  v_descricao := NULLIF(btrim(COALESCE(_a.description, '')), '');
  IF v_descricao IS NOT NULL THEN
    v_texto := v_texto || ' ' || v_descricao;
  END IF;

  RETURN v_texto;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_notify_activity_completed(_a public.user_activities)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (recipient_id, type, payload)
  SELECT
    CASE
      WHEN uf.requester_id = _a.user_id THEN uf.addressee_id
      ELSE uf.requester_id
    END,
    'activity_completed',
    jsonb_build_object('authorId', _a.user_id, 'activityId', _a.id)
  FROM public.user_friends uf
  WHERE uf.status = 'accepted'
    AND (uf.requester_id = _a.user_id OR uf.addressee_id = _a.user_id);
END;
$$;


-- ############################################################################
-- 2) 20260821090000_live-activity-friends-view.sql
-- ############################################################################

CREATE OR REPLACE FUNCTION public.live_activity_type(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.activity_type
  FROM public.user_activities a
  WHERE a.user_id = _user_id
    AND a.status = 'in_progress'
  ORDER BY a.start_time DESC
  LIMIT 1;
$$;

DROP VIEW IF EXISTS public.public_user_locations_live;
CREATE VIEW public.public_user_locations_live
WITH (security_invoker=on) AS
SELECT
  p.id,
  p.full_name,
  p.username,
  p.avatar_url,
  p.latitude,
  p.longitude,
  p.location_updated_at,
  p.location_sharing_mode,
  public.live_activity_type(p.id) AS activity_type,
  (
    public.live_activity_type(p.id) IS NOT NULL
    AND p.location_updated_at > (now() - interval '120 seconds')
  ) AS is_live
FROM public.profiles p
WHERE p.latitude IS NOT NULL
  AND p.longitude IS NOT NULL
  AND p.location_updated_at IS NOT NULL
  AND p.location_updated_at > (now() - interval '24 hours')
  AND (
    p.location_sharing_mode = 'public'
    OR (p.location_sharing_mode = 'friends' AND public.are_friends(auth.uid(), p.id))
    OR p.id = auth.uid()
  );

GRANT SELECT ON public.public_user_locations_live TO anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_user_activities_user_status
  ON public.user_activities (user_id, status)
  WHERE status = 'in_progress';


-- ############################################################################
-- 3) 20260822090000_community-post-activity-link.sql
--    (recria finish_user_activity de 9 args; substituída em seguida pela de 10)
-- ############################################################################

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS activity_id UUID REFERENCES public.user_activities(id) ON DELETE SET NULL;


-- ############################################################################
-- 4) 20260908120000_community-post-video.sql  (Bloco D)
-- ############################################################################

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS video_url text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'community-post-videos',
  'community-post-videos',
  true,
  31457280,
  ARRAY['video/mp4','video/webm','video/quicktime']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Community post videos are public readable" ON storage.objects;
CREATE POLICY "Community post videos are public readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'community-post-videos');

DROP POLICY IF EXISTS "Owners can upload to their community post videos folder" ON storage.objects;
CREATE POLICY "Owners can upload to their community post videos folder"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'community-post-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Owners can update their community post videos" ON storage.objects;
CREATE POLICY "Owners can update their community post videos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'community-post-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Owners can delete their community post videos" ON storage.objects;
CREATE POLICY "Owners can delete their community post videos"
ON storage.objects FOR DELETE
USING (bucket_id = 'community-post-videos' AND auth.uid()::text = (storage.foldername(name))[1]);


-- ############################################################################
-- 5) 20260908120500_finish-activity-video.sql  (Bloco D)
--    VERSÃO FINAL de finish_user_activity (10 args, com _video_url).
-- ############################################################################

ALTER TABLE public.user_activities
  ADD COLUMN IF NOT EXISTS video_url TEXT;

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
  _video_url TEXT DEFAULT NULL
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


-- ############################################################################
-- 6) 20260908130000_gamificacao-niveis-rank.sql  (Bloco E)
-- ############################################################################

CREATE OR REPLACE VIEW public.user_level_stats AS
SELECT
  ua.user_id,
  ua.activity_type,
  COUNT(*)                                        AS completed_activities,
  COALESCE(SUM(ua.distance_meters), 0) / 1000.0   AS total_km,
  COALESCE(SUM(ua.elevation_gain), 0)             AS total_elevation
FROM public.user_activities ua
WHERE ua.status = 'completed'
GROUP BY ua.user_id, ua.activity_type;

CREATE OR REPLACE FUNCTION public.fetch_activity_ranking(
  _metric TEXT,
  _scope TEXT DEFAULT 'global',
  _since TIMESTAMPTZ DEFAULT NULL,
  _destination_id UUID DEFAULT NULL,
  _limit INTEGER DEFAULT 50
) RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  username TEXT,
  avatar_url TEXT,
  value NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH scoped AS (
    SELECT ua.*
    FROM public.user_activities ua
    WHERE ua.status = 'completed'
      AND (_since IS NULL OR ua.start_time >= _since)
      AND (_destination_id IS NULL OR ua.destination_id = _destination_id)
      AND (
        _scope <> 'seguidos'
        OR ua.user_id = auth.uid()
        OR ua.user_id IN (
          SELECT uf.addressee_id
          FROM public.user_friends uf
          WHERE uf.requester_id = auth.uid()
            AND uf.status IN ('following', 'accepted')
        )
      )
  ),
  agg AS (
    SELECT
      s.user_id,
      CASE
        WHEN _metric = 'distancia'  THEN COALESCE(SUM(s.distance_meters), 0)
        WHEN _metric = 'altimetria' THEN COALESCE(SUM(s.elevation_gain), 0)
        WHEN _metric = 'tempo'      THEN COALESCE(MIN(NULLIF(s.duration_seconds, 0)), 0)
        ELSE 0
      END AS value
    FROM scoped s
    GROUP BY s.user_id
  )
  SELECT
    a.user_id,
    p.full_name,
    p.username,
    p.avatar_url,
    a.value
  FROM agg a
  JOIN public.profiles p ON p.id = a.user_id
  WHERE a.value > 0
  ORDER BY
    CASE WHEN _metric = 'tempo' THEN a.value END ASC,
    CASE WHEN _metric <> 'tempo' THEN a.value END DESC,
    a.user_id ASC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 50), 200));
$$;

GRANT EXECUTE ON FUNCTION public.fetch_activity_ranking(TEXT, TEXT, TIMESTAMPTZ, UUID, INTEGER) TO authenticated;


-- ############################################################################
-- 7) 20260908140000_cadastros-completos.sql  (Bloco F)
-- ############################################################################

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS person_type TEXT,
  ADD COLUMN IF NOT EXISTS address_zip TEXT,
  ADD COLUMN IF NOT EXISTS address_street TEXT,
  ADD COLUMN IF NOT EXISTS address_number TEXT,
  ADD COLUMN IF NOT EXISTS address_complement TEXT,
  ADD COLUMN IF NOT EXISTS address_neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS address_city TEXT,
  ADD COLUMN IF NOT EXISTS address_state TEXT;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_person_type_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_person_type_check
  CHECK (person_type IS NULL OR person_type IN ('pf', 'pj'));

ALTER TABLE public.profile_contacts
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS phone_secondary TEXT;


-- ============================================================================
-- FIM. Após rodar sem erro, os recursos dos Blocos D/E/F estão ativos no banco.
-- ============================================================================
