-- Rate_Limiting_Policy (Requirement 12.1, 12.2)
--
-- Adiciona a tabela de log de chamadas, a função de decisão fn_check_rate_limit
-- e aplica a política nas três RPCs expostas ao cliente que precisam de
-- proteção contra abuso: finish_user_activity, increment_partner_profile_view
-- e increment_partner_contact_click.
--
-- Em todas as três funções, a chamada a fn_check_rate_limit ocorre como a
-- PRIMEIRA instrução do corpo, antes de qualquer efeito (UPDATE). Como toda
-- a função executa dentro de uma única transação implícita do Postgres, uma
-- chamada rejeitada (RAISE EXCEPTION) faz rollback automático de qualquer
-- coisa que tivesse sido feita antes -- e neste caso nada foi feito ainda --
-- garantindo que o efeito da RPC nunca é persistido quando o limite é
-- excedido (Requirement 12.2).

-- 1. Tabela de log das chamadas por usuário/RPC
CREATE TABLE public.rpc_rate_limit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  rpc_name TEXT NOT NULL,
  called_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX rpc_rate_limit_log_lookup_idx
  ON public.rpc_rate_limit_log (user_id, rpc_name, called_at DESC);

-- 2. Função de decisão do rate limiter
--
-- Conta quantas chamadas de (_user_id, _rpc_name) ocorreram dentro da janela
-- deslizante [now() - _window_seconds, now()]. Se o limite já foi atingido
-- ou excedido, lança uma exceção com ERRCODE dedicado (P0429, análogo ao
-- HTTP 429 Too Many Requests) SEM inserir a linha da chamada atual. Caso
-- contrário, registra a chamada atual e retorna normalmente, permitindo que
-- a RPC chamadora prossiga com seu efeito.
CREATE OR REPLACE FUNCTION public.fn_check_rate_limit(
  _user_id UUID,
  _rpc_name TEXT,
  _max_calls INTEGER,
  _window_seconds INTEGER
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_calls INTEGER;
BEGIN
  SELECT count(*)
    INTO recent_calls
    FROM public.rpc_rate_limit_log
   WHERE user_id = _user_id
     AND rpc_name = _rpc_name
     AND called_at > now() - (_window_seconds || ' seconds')::interval;

  IF recent_calls >= _max_calls THEN
    RAISE EXCEPTION 'Rate limit exceeded for %', _rpc_name
      USING ERRCODE = 'P0429';
  END IF;

  INSERT INTO public.rpc_rate_limit_log (user_id, rpc_name, called_at)
  VALUES (_user_id, _rpc_name, now());
END;
$$;

REVOKE ALL ON FUNCTION public.fn_check_rate_limit(uuid, text, integer, integer) FROM PUBLIC;

-- 3. Aplicação da política nas RPCs limitadas
--
-- Recriadas com EXATAMENTE o mesmo corpo/assinatura de hoje, apenas com a
-- checagem de rate limit adicionada como primeira linha do corpo.
--
-- Nota: increment_partner_profile_view e increment_partner_contact_click são
-- concedidas também a `anon` (chamadas por visitantes não autenticados, para
-- registrar visualizações/cliques em perfis de parceiros). Requirement 12.1
-- escopa a Rate_Limiting_Policy a "usuário autenticado". Como
-- rpc_rate_limit_log.user_id é NOT NULL, a checagem só é executada quando
-- auth.uid() não é nulo -- preservando o comportamento atual (sem limite)
-- para chamadas anônimas, e sem risco de falha por violação de NOT NULL.

-- 3.1 finish_user_activity (limite: 20 chamadas / 3600s)
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
  IF auth.uid() IS NOT NULL THEN
    PERFORM public.fn_check_rate_limit(auth.uid(), 'finish_user_activity', 20, 3600);
  END IF;

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

-- 3.2 increment_partner_profile_view (limite: 100 chamadas / 3600s)
CREATE OR REPLACE FUNCTION public.increment_partner_profile_view(_partner_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    PERFORM public.fn_check_rate_limit(auth.uid(), 'increment_partner_profile_view', 100, 3600);
  END IF;

  UPDATE public.profiles
     SET profile_views = COALESCE(profile_views, 0) + 1,
         updated_at = now()
   WHERE id = _partner_id
     AND role = 'partner';
END;
$$;

-- 3.3 increment_partner_contact_click (limite: 30 chamadas / 3600s)
CREATE OR REPLACE FUNCTION public.increment_partner_contact_click(_partner_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count integer;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    PERFORM public.fn_check_rate_limit(auth.uid(), 'increment_partner_contact_click', 30, 3600);
  END IF;

  UPDATE public.profiles
     SET contact_clicks = COALESCE(contact_clicks, 0) + 1,
         trial_active = CASE
           WHEN COALESCE(contact_clicks, 0) + 1 >= 15 THEN false
           ELSE trial_active
         END,
         updated_at = now()
   WHERE id = _partner_id
     AND role = 'partner'
  RETURNING contact_clicks INTO new_count;
  RETURN COALESCE(new_count, 0);
END;
$$;
