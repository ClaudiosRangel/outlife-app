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


-- ############################################################################
-- 8) FIX — saved_destinations + favorite_partners (idempotente)
--    Corrige o erro "Não foi possível concluir a ação" ao salvar destino /
--    favoritar parceiro, quando a migration 20260715160100 não foi aplicada
--    em produção. Seguro rodar de novo: só cria o que faltar.
-- ############################################################################

CREATE TABLE IF NOT EXISTS public.saved_destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  destination_id UUID NOT NULL REFERENCES public.destinations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, destination_id)
);
ALTER TABLE public.saved_destinations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own saved destinations" ON public.saved_destinations;
CREATE POLICY "Users can view their own saved destinations"
  ON public.saved_destinations FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can save their own destinations" ON public.saved_destinations;
CREATE POLICY "Users can save their own destinations"
  ON public.saved_destinations FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can unsave their own destinations" ON public.saved_destinations;
CREATE POLICY "Users can unsave their own destinations"
  ON public.saved_destinations FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.favorite_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, partner_id)
);
ALTER TABLE public.favorite_partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own favorite partners" ON public.favorite_partners;
CREATE POLICY "Users can view their own favorite partners"
  ON public.favorite_partners FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can favorite partners" ON public.favorite_partners;
CREATE POLICY "Users can favorite partners"
  ON public.favorite_partners FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can unfavorite partners" ON public.favorite_partners;
CREATE POLICY "Users can unfavorite partners"
  ON public.favorite_partners FOR DELETE USING (auth.uid() = user_id);


-- ############################################################################
-- 9) FIX — recálculo de rating/reviews_count ao avaliar (idempotente)
--    Corrige "0 avaliações" e estrelas que não incrementavam após avaliar.
-- ############################################################################

CREATE OR REPLACE FUNCTION public.recalc_review_aggregates(
  _partner_id UUID,
  _destination_id UUID
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_avg NUMERIC; v_count INTEGER;
BEGIN
  IF _partner_id IS NOT NULL THEN
    SELECT COALESCE(ROUND(AVG(rating)::numeric, 2), 0), COUNT(*) INTO v_avg, v_count
      FROM public.reviews WHERE partner_id = _partner_id;
    UPDATE public.profiles SET rating = v_avg, reviews_count = v_count, updated_at = now()
     WHERE id = _partner_id;
  END IF;
  IF _destination_id IS NOT NULL THEN
    SELECT COALESCE(ROUND(AVG(rating)::numeric, 2), 0) INTO v_avg
      FROM public.reviews WHERE destination_id = _destination_id;
    UPDATE public.destinations SET rating = v_avg WHERE id = _destination_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_recalc_review_aggregates()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP <> 'DELETE' THEN
    PERFORM public.recalc_review_aggregates(NEW.partner_id, NEW.destination_id);
  END IF;
  IF TG_OP <> 'INSERT' THEN
    PERFORM public.recalc_review_aggregates(OLD.partner_id, OLD.destination_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_review_aggregates ON public.reviews;
CREATE TRIGGER trg_recalc_review_aggregates
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_review_aggregates();

-- Backfill (recalcula o que já existe, ex.: a avaliação que você já fez)
UPDATE public.profiles p
   SET rating = sub.avg_rating, reviews_count = sub.cnt, updated_at = now()
  FROM (SELECT partner_id, ROUND(AVG(rating)::numeric, 2) AS avg_rating, COUNT(*) AS cnt
          FROM public.reviews WHERE partner_id IS NOT NULL GROUP BY partner_id) sub
 WHERE p.id = sub.partner_id;

UPDATE public.destinations d
   SET rating = sub.avg_rating
  FROM (SELECT destination_id, ROUND(AVG(rating)::numeric, 2) AS avg_rating
          FROM public.reviews WHERE destination_id IS NOT NULL GROUP BY destination_id) sub
 WHERE d.id = sub.destination_id;


-- ############################################################################
-- 10) FIX — backfill de profiles para usuários sem perfil (idempotente)
--     Causa provável do "curtir" falhar mesmo com favorite_partners criada:
--     contas antigas (criadas antes do trigger handle_new_user) não têm linha
--     em public.profiles, então o INSERT em favorite_partners/saved_destinations
--     viola a FK user_id -> profiles(id). Aqui criamos o profile que faltar.
-- ############################################################################

INSERT INTO public.profiles (id, full_name, username, role)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', split_part(u.email, '@', 1)),
  COALESCE(u.raw_user_meta_data ->> 'username', split_part(u.email, '@', 1) || '_' || substr(u.id::text, 1, 6)),
  COALESCE((u.raw_user_meta_data ->> 'role')::public.app_role, 'adventurer')
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;


-- ############################################################################
-- 11) Painel do parceiro: leads/reservas, avaliações recebidas, favoritos,
--     notificação/push ao parceiro (idempotente).
-- ############################################################################

CREATE TABLE IF NOT EXISTS public.partner_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS partner_leads_partner_idx ON public.partner_leads (partner_id, created_at DESC);
ALTER TABLE public.partner_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Partner views own leads" ON public.partner_leads;
CREATE POLICY "Partner views own leads" ON public.partner_leads FOR SELECT USING (auth.uid() = partner_id);
DROP POLICY IF EXISTS "User creates own lead" ON public.partner_leads;
CREATE POLICY "User creates own lead" ON public.partner_leads FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.create_partner_lead(_partner_id UUID, _message TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  INSERT INTO public.partner_leads (partner_id, user_id, message) VALUES (_partner_id, v_user, _message);
  BEGIN
    INSERT INTO public.notifications (recipient_id, type, payload)
    VALUES (_partner_id, 'partner_lead', jsonb_build_object('userId', v_user));
  EXCEPTION WHEN OTHERS THEN NULL; END;
END; $$;
GRANT EXECUTE ON FUNCTION public.create_partner_lead(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.trg_notify_partner_review()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.partner_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.notifications (recipient_id, type, payload)
      VALUES (NEW.partner_id, 'review_received', jsonb_build_object('authorId', NEW.author_id, 'rating', NEW.rating));
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_partner_review ON public.reviews;
CREATE TRIGGER trg_notify_partner_review AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_partner_review();

CREATE OR REPLACE FUNCTION public.fetch_partner_leads(_limit INTEGER DEFAULT 50)
RETURNS TABLE (id UUID, user_id UUID, full_name TEXT, avatar_url TEXT, message TEXT, created_at TIMESTAMPTZ)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT l.id, l.user_id, p.full_name, p.avatar_url, l.message, l.created_at
  FROM public.partner_leads l JOIN public.profiles p ON p.id = l.user_id
  WHERE l.partner_id = auth.uid()
  ORDER BY l.created_at DESC LIMIT GREATEST(1, LEAST(COALESCE(_limit, 50), 200));
$$;
GRANT EXECUTE ON FUNCTION public.fetch_partner_leads(INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.count_my_partner_favorites()
RETURNS INTEGER LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::INTEGER FROM public.favorite_partners WHERE partner_id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.count_my_partner_favorites() TO authenticated;


-- ############################################################################
-- 12) Badge do ícone do app: incluir a contagem de não-lidas no push
--     Recalcula fn_send_native_push para enviar tambevery o "badge" (nº de
--     notificações não lidas do destinatário) ao endpoint FCM.
-- ############################################################################

CREATE OR REPLACE FUNCTION public.fn_dispatch_push_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  token_row RECORD;
  sub_row RECORD;
  v_unread INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_unread
    FROM public.notifications
   WHERE recipient_id = NEW.recipient_id AND is_read = false;

  FOR token_row IN
    SELECT token, platform FROM public.native_push_tokens
    WHERE user_id = NEW.recipient_id AND is_active
  LOOP
    BEGIN
      PERFORM public.fn_send_native_push(token_row.token, token_row.platform, NEW.type,
        jsonb_build_object('badge', v_unread) || to_jsonb(NEW));
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;

  FOR sub_row IN
    SELECT endpoint, p256dh, auth FROM public.web_push_subscriptions
    WHERE user_id = NEW.recipient_id AND is_active
  LOOP
    BEGIN
      PERFORM public.fn_send_web_push(sub_row.endpoint, sub_row.p256dh, sub_row.auth, NEW.type, to_jsonb(NEW));
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;

  RETURN NEW;
END; $$;

-- Recalcula fn_send_native_push para repassar o badge ao endpoint HTTP.
-- IMPORTANTE: usa net.http_post (extensão pg_net), com body JSONB. NÃO usar
-- extensions.http_post (não existe neste projeto — causava falha silenciosa).
CREATE OR REPLACE FUNCTION public.fn_send_native_push(
  _token TEXT, _platform TEXT, _type TEXT, _payload JSONB
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _app_url TEXT := 'https://outlife-app.vercel.app';
  _secret TEXT := 'outlife-push-2026';
BEGIN
  PERFORM net.http_post(
    url := _app_url || '/api/push/send-fcm',
    body := jsonb_build_object(
      'token', _token,
      'type', _type,
      'badge', COALESCE((_payload ->> 'badge')::int, 0),
      'secret', _secret
    ),
    headers := jsonb_build_object('Content-Type', 'application/json')
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'fn_send_native_push falhou: %', SQLERRM;
END; $$;


-- ############################################################################
-- 13) 20260910100000_admin-suggestions-checklist.sql (Dicas/Melhorias admin)
-- ############################################################################

CREATE TABLE IF NOT EXISTS public.admin_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  done BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  done_at TIMESTAMPTZ,
  done_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS admin_suggestions_done_idx
  ON public.admin_suggestions (done, created_at DESC);

ALTER TABLE public.admin_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins select suggestions" ON public.admin_suggestions;
CREATE POLICY "Admins select suggestions"
  ON public.admin_suggestions FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins insert suggestions" ON public.admin_suggestions;
CREATE POLICY "Admins insert suggestions"
  ON public.admin_suggestions FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()) AND auth.uid() = created_by);

DROP POLICY IF EXISTS "Admins update suggestions" ON public.admin_suggestions;
CREATE POLICY "Admins update suggestions"
  ON public.admin_suggestions FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins delete suggestions" ON public.admin_suggestions;
CREATE POLICY "Admins delete suggestions"
  ON public.admin_suggestions FOR DELETE
  USING (public.is_admin(auth.uid()));


-- ############################################################################
-- 14) 20260910120000_fix-native-push-http.sql (CORREÇÃO CRÍTICA do push)
--     fn_send_native_push usava extensions.http_post (inexistente) → trocado
--     por net.http_post (pg_net), body JSONB. Sem isso NENHUM push saía.
-- ############################################################################
-- (o corpo definitivo de fn_send_native_push já está no item 12 acima,
--  atualizado para net.http_post — reaplicar é idempotente)

-- ############################################################################
-- 15) 20260910140000_admin-content-and-dashboard.sql
--     app_content (textos editáveis da Home) + admin_dashboard_stats() (RPC)
-- ############################################################################

CREATE TABLE IF NOT EXISTS public.app_content (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);
ALTER TABLE public.app_content ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone reads app_content" ON public.app_content;
CREATE POLICY "Anyone reads app_content" ON public.app_content FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins upsert app_content" ON public.app_content;
CREATE POLICY "Admins upsert app_content" ON public.app_content FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins update app_content" ON public.app_content;
CREATE POLICY "Admins update app_content" ON public.app_content FOR UPDATE USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _result JSONB;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT jsonb_build_object(
    'usuarios_total',(SELECT count(*) FROM public.profiles),
    'usuarios_verificados',(SELECT count(*) FROM public.profiles WHERE is_verified),
    'ativos_7d',(SELECT count(*) FROM auth.users WHERE last_sign_in_at >= now() - interval '7 days'),
    'ativos_30d',(SELECT count(*) FROM auth.users WHERE last_sign_in_at >= now() - interval '30 days'),
    'novos_7d',(SELECT count(*) FROM public.profiles WHERE created_at >= now() - interval '7 days'),
    'publicacoes_total',(SELECT count(*) FROM public.community_posts),
    'publicacoes_7d',(SELECT count(*) FROM public.community_posts WHERE created_at >= now() - interval '7 days'),
    'curtidas_total',(SELECT count(*) FROM public.post_likes),
    'comentarios_total',(SELECT count(*) FROM public.post_comments),
    'avaliacoes_total',(SELECT count(*) FROM public.reviews),
    'interacoes_total',((SELECT count(*) FROM public.post_likes)+(SELECT count(*) FROM public.post_comments)+(SELECT count(*) FROM public.reviews)),
    'atividades_total',(SELECT count(*) FROM public.user_activities),
    'atividades_7d',(SELECT count(*) FROM public.user_activities WHERE start_time >= now() - interval '7 days'),
    'eventos_total',(SELECT count(*) FROM public.events),
    'destinos_total',(SELECT count(*) FROM public.destinations),
    'leads_total',(SELECT count(*) FROM public.partner_leads)
  ) INTO _result;
  RETURN _result;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;

INSERT INTO public.app_content (key, value) VALUES
  ('home.slogan', '“A vida não é só trilhar.
Viver é diferente
de estar vivo.”'),
  ('home.ecosystem', 'OutVitar · ecossistema')
ON CONFLICT (key) DO NOTHING;


-- ############################################################################
-- 16) 20260911150000_activities-public-completed-select.sql
--     Atividades concluídas visíveis para todos (feed/deep link).
-- ############################################################################
DROP POLICY IF EXISTS "Anyone can view completed activities" ON public.user_activities;
CREATE POLICY "Anyone can view completed activities"
  ON public.user_activities FOR SELECT USING (status = 'completed');

-- ############################################################################
-- 17) 20260911160000_user-feedback.sql ("Dê sua opinião" + admin)
-- ############################################################################
CREATE TABLE IF NOT EXISTS public.user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_feedback_created_idx ON public.user_feedback (created_at DESC);
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users create own feedback" ON public.user_feedback;
CREATE POLICY "Users create own feedback" ON public.user_feedback FOR INSERT WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "Author or admin reads feedback" ON public.user_feedback;
CREATE POLICY "Author or admin reads feedback" ON public.user_feedback FOR SELECT USING (auth.uid() = author_id OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admin deletes feedback" ON public.user_feedback;
CREATE POLICY "Admin deletes feedback" ON public.user_feedback FOR DELETE USING (public.is_admin(auth.uid()));
CREATE OR REPLACE FUNCTION public.admin_fetch_feedback(_limit INTEGER DEFAULT 100)
RETURNS TABLE (id UUID, author_id UUID, full_name TEXT, avatar_url TEXT, rating INTEGER, message TEXT, created_at TIMESTAMPTZ)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT f.id, f.author_id, p.full_name, p.avatar_url, f.rating, f.message, f.created_at
  FROM public.user_feedback f JOIN public.profiles p ON p.id = f.author_id
  WHERE public.is_admin(auth.uid())
  ORDER BY f.created_at DESC LIMIT GREATEST(1, LEAST(COALESCE(_limit, 100), 500));
$$;
GRANT EXECUTE ON FUNCTION public.admin_fetch_feedback(INTEGER) TO authenticated;


-- ############################################################################
-- 18) 20260911170000_partner-trial-started-at.sql
--     Frente A: trial de parceiro por data (1 ano). Coluna nullable; fallback
--     para created_at na aplicação.
-- ############################################################################
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;


-- ############################################################################
-- 19) 20260912100000_comment-threads-likes.sql
--     Frente C: post_comments.parent_comment_id (threads) + likes_count +
--     tabela comment_likes (RLS) + RLS delete own/admin + RPCs
--     create_post_comment(_parent), toggle_comment_like, delete_post_comment.
--     (SQL completo no arquivo de migration; idempotente)
-- ############################################################################


-- ############################################################################
-- 20) 20260912110000_activity-types-catalog.sql
--     Frente D: tabela activity_types (code/name/icon_key/metric_form/active/
--     position) + RLS (leitura pública, escrita admin); relaxa o CHECK de
--     user_activities.activity_type; seed idempotente dos 8 tipos padrão.
--     (SQL completo no arquivo de migration; idempotente)
-- ############################################################################

-- ############################################################################
-- 21) 20260912120000_suggest-friends.sql
--     Frente F: RPC suggest_friends(_limit) (SECURITY DEFINER) — sugere
--     amigos-de-amigos + usuarios com atividade (completed) em comum,
--     excluindo o proprio usuario e qualquer relacao existente em user_friends
--     (qualquer status/direcao); dedup por candidato; so campos publicos.
--     (SQL completo no arquivo de migration; idempotente)
-- ############################################################################

-- ############################################################################
-- 22) 20260912130000_destination-visits-achievements.sql
--     Frente G: tabela user_destination_visits (UNIQUE user+destination, RLS
--     leitura propria; escrita so via RPC) + RPCs register_destination_visits
--     (cruza route_geojson x destinos aprovados via ST_DWithin, raio 500m) e
--     grant_destination_achievements (keys destinos_1/5/10 em
--     achievement_records, idempotente). (SQL completo no arquivo; idempotente)
-- ############################################################################

-- ############################################################################
-- 23) 20260912140000_imported-trails.sql
--     Frente H: tabela imported_trails (external_source osm/icmbio,
--     UNIQUE source+external_id, visible default false, license, attribution)
--     + RLS (leitura: visible OR admin; escrita: admin). Importação via
--     scripts/import-trails.mjs. (SQL completo no arquivo; idempotente)
-- ############################################################################
