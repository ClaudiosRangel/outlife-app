-- Melhorias na Atividade Rastreada — coluna de elevação + efeitos de
-- finalização (spec `atividade-rastreada-melhorias`).
--
-- Esta migration é INCREMENTAL e IDEMPOTENTE, seguindo o padrão de
-- `20260721000000_activity-type-and-map-snapshot.sql`: colunas opcionais
-- (`ADD COLUMN IF NOT EXISTS`), funções com `CREATE OR REPLACE` e
-- `finish_user_activity` estendida com parâmetros opcionais no final da
-- assinatura, preservando compatibilidade com chamadores existentes.
--
-- Nunca editar migrations já aplicadas — este é um arquivo novo com
-- timestamp posterior aos existentes.
--
-- Conteúdo (por subtarefa do plano):
--   1.1 Coluna `elevation_gain` em `user_activities` (Requirements 1.1, 1.4)
--   1.2 `fn_map_activity_type_to_category` (Requirement 4.2)
--   1.3 `fn_build_activity_post_text` (Requirement 4.4)
--   1.4 `fn_notify_activity_completed` (Requirements 5.1, 5.2, 5.5)
--   1.5 `finish_user_activity` estendida (Requirements 1.1, 4.x, 5.x)

-- 1.1 — Persistência do ganho de elevação (Elevation_Gain).
-- Coluna opcional (nullable), em metros. Ausente/NULL significa "não
-- disponível" e é exibido como "—" na tela de detalhe (Requirement 1.3).
ALTER TABLE public.user_activities
  ADD COLUMN IF NOT EXISTS elevation_gain NUMERIC;
-- 1.2 — Mapeamento Activity_Type -> Community_Post_Category (Requirement 4.2).
-- Função pura IMMUTABLE que traduz o tipo da atividade na categoria da
-- publicação da comunidade. Toda categoria retornada pertence ao conjunto
-- aceito pelo CHECK constraint `community_posts_category_check`
-- ('trilha', 'camping', 'relato', 'outro', 'pedalada', 'caminhada' — ver
-- 20260721010000_community-post-category-pedalada-caminhada.sql).
--
-- Mapeamento:
--   caminhada -> caminhada
--   pedalada  -> pedalada
--   trilha    -> trilha
--   outro     -> outro
--   NULL / qualquer outro valor -> outro (fallback seguro, Property P5)
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

-- 1.3 — Texto do Community_Post a partir de uma User_Activity (Requirement 4.4).
-- Função pura de formatação (IMMUTABLE): monta o texto da publicação da
-- comunidade com as métricas principais (distância + duração) e a descrição
-- do usuário quando presente. Recebe a linha inteira de `user_activities`
-- (`_a public.user_activities`), lendo os campos reais:
--   `distance_meters` (NUMERIC), `duration_seconds` (INTEGER),
--   `description` (TEXT), `activity_type` (TEXT).
--
-- Regras de formatação:
--   Distância:
--     >= 1000 m  -> km com uma casa decimal (ex.: "12.4 km")
--     <  1000 m  -> metros inteiros (ex.: "740 m")
--     NULL/<= 0  -> "0 m"
--   Duração:
--     <  1h -> mm:ss   (ex.: "47:12")
--     >= 1h -> h:mm:ss (ex.: "1:05:03")
--     NULL  -> tratado como 0 ("00:00")
--   Substantivo derivado do Activity_Type:
--     caminhada -> "uma caminhada"
--     pedalada  -> "uma pedalada"
--     trilha    -> "uma trilha"
--     outro/NULL/demais -> "uma atividade"
--
-- Exemplo (design.md): "Concluí uma pedalada de 12.4 km em 47:12. <descrição>"
--
-- A descrição do usuário, quando não vazia, é anexada ao final após um
-- espaço. Quando ausente/em branco, o texto termina na frase de métricas.
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
  -- Distância formatada (km com uma casa decimal quando >= 1000 m; senão metros inteiros).
  IF v_metros >= 1000 THEN
    v_distancia := to_char(round(v_metros / 1000.0, 1), 'FM990.0') || ' km';
  ELSE
    v_distancia := round(GREATEST(v_metros, 0))::INTEGER::TEXT || ' m';
  END IF;

  -- Duração formatada (mm:ss quando < 1h; h:mm:ss quando >= 1h).
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

  -- Substantivo conforme o tipo de atividade.
  v_substantivo := CASE _a.activity_type
    WHEN 'caminhada' THEN 'uma caminhada'
    WHEN 'pedalada'  THEN 'uma pedalada'
    WHEN 'trilha'    THEN 'uma trilha'
    ELSE 'uma atividade'
  END;

  v_texto := 'Concluí ' || v_substantivo || ' de ' || v_distancia || ' em ' || v_duracao || '.';

  -- Descrição do usuário quando presente (não nula e não em branco).
  v_descricao := NULLIF(btrim(COALESCE(_a.description, '')), '');
  IF v_descricao IS NOT NULL THEN
    v_texto := v_texto || ' ' || v_descricao;
  END IF;

  RETURN v_texto;
END;
$$;

-- 1.4 — Notificar amigos ao concluir uma atividade (Requirements 5.1, 5.2, 5.5).
-- Função SECURITY DEFINER que cria uma Notification para cada amizade com
-- status = 'accepted' que envolve o autor da atividade, escolhendo o "outro
-- lado" da amizade como `recipient_id`.
--
-- Estrutura real das tabelas (confirmada nas migrations existentes):
--   public.user_friends (20260716090100 / 20260718090000):
--     colunas `requester_id`, `addressee_id`, `status`, `id`; status é TEXT
--     com CHECK IN ('pending','accepted','blocked','following'). O valor de
--     amizade mútua é 'accepted' (seguir é 'following' e NÃO gera notificação
--     aqui, pois o filtro é estrito em status = 'accepted').
--   public.notifications (20260716090300):
--     colunas `recipient_id`, `type`, `payload` (jsonb). Não há policy de
--     INSERT do cliente — a criação de notificações é feita exclusivamente
--     por funções SECURITY DEFINER controladas pelo servidor, para o usuário
--     não poder forjar notificações. Esta função espelha exatamente o padrão
--     de `notify_on_friend_request` / `notify_on_post_like` (ambas
--     SECURITY DEFINER, SET search_path = public).
--
-- Regras (Property P7):
--   - Uma notificação por amizade `accepted` que envolve o autor
--     (Requirement 5.1). O `recipient_id` é sempre o "outro lado":
--       quando requester_id = autor  -> recipient = addressee_id
--       caso contrário (addressee = autor) -> recipient = requester_id
--   - `type = 'activity_completed'`;
--     `payload = { authorId: <id do autor>, activityId: <id da atividade> }`
--     (Requirement 5.2).
--   - Quando o autor não tem nenhum amigo `accepted`, o SELECT não retorna
--     linhas e nenhum INSERT ocorre (Requirement 5.5).
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

-- 1.5 — finish_user_activity estendida: elevação + efeitos de finalização
-- (Requirements 1.1, 4.1, 4.3, 4.4, 4.5, 5.1, 5.6, 5.8 | Properties P6, P8).
--
-- Base EXATA: a definição mais recente de `finish_user_activity`
-- (20260721000000_activity-type-and-map-snapshot.sql). Preservamos
-- integralmente:
--   - SECURITY INVOKER + SET search_path = public + LANGUAGE plpgsql
--   - os 8 parâmetros existentes, na mesma ordem
--     (_id, _geojson, _distance, _duration, _description, _image_url,
--      _activity_type, _map_snapshot_url)
--   - o rate limit `fn_check_rate_limit(..., 'finish_user_activity', 20, 3600)`
--   - o UPDATE com ST_GeogFromText(ST_AsText(ST_GeomFromGeoJSON(...))) e os
--     COALESCE de description/image_url/activity_type/map_snapshot_url
--   - o RETURNING * INTO result e o RETURN result
--
-- Acréscimos desta subtarefa (e SOMENTE eles):
--   - novo parâmetro opcional `_elevation_gain NUMERIC DEFAULT NULL` NO FIM
--     da assinatura (preserva compatibilidade com chamadores existentes);
--   - persistência `elevation_gain = COALESCE(_elevation_gain, elevation_gain)`
--     no UPDATE (Requirement 1.1);
--   - após o UPDATE que marca status='completed', dois efeitos de finalização
--     isolados, cada um em bloco `BEGIN ... EXCEPTION WHEN OTHERS THEN NULL`:
--       (a) INSERT em community_posts — author_id = result.user_id,
--           text via fn_build_activity_post_text(result),
--           category via fn_map_activity_type_to_category(result.activity_type),
--           image_url = result.map_snapshot_url (Requirements 4.1/4.3/4.4);
--           o INSERT roda como SECURITY INVOKER, satisfazendo a RLS
--           `WITH CHECK (auth.uid() = author_id)` de community_posts.
--       (b) PERFORM fn_notify_activity_completed(result) — notifica amigos
--           accepted (Requirement 5.1), via função SECURITY DEFINER.
--     O isolamento em EXCEPTION garante que falha de post/notificação NÃO
--     reverte nem perde a atividade já concluída (Requirements 4.5/5.6/5.8,
--     Property P6). Como os efeitos rodam só aqui (único ponto de transição
--     para 'completed'), não há disparo duplicado em updates incrementais
--     de progresso (Property P8).
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
  -- reverte a atividade já concluída).
  BEGIN
    INSERT INTO public.community_posts (author_id, text, category, image_url)
    VALUES (
      result.user_id,
      public.fn_build_activity_post_text(result),
      public.fn_map_activity_type_to_category(result.activity_type),
      result.map_snapshot_url
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Req 4.5
  END;

  -- Req 5: notifica amigos accepted (SECURITY DEFINER, isolado — falha é
  -- definitiva, sem reprocessamento).
  BEGIN
    PERFORM public.fn_notify_activity_completed(result);
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Req 5.6/5.8
  END;

  RETURN result;
END;
$$;
