-- partner_metric_daily: historico diario de metricas do parceiro, usado pelo
-- grafico real do painel do parceiro (Requirement 12.2), e atualizacao das
-- RPCs increment_partner_profile_view/increment_partner_contact_click para
-- tambem persistirem o incremento do dia corrente nessa tabela.
--
-- Requirements: 12.2

-- ============ PARTNER_METRIC_DAILY ============
CREATE TABLE public.partner_metric_daily (
  id BIGSERIAL PRIMARY KEY,
  partner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  contact_clicks INTEGER NOT NULL DEFAULT 0,
  UNIQUE (partner_id, day)
);

ALTER TABLE public.partner_metric_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners view their own metric history"
  ON public.partner_metric_daily FOR SELECT
  USING (auth.uid() = partner_id);

-- Nenhuma policy de INSERT/UPDATE e criada de proposito: a escrita nesta
-- tabela ocorre exclusivamente atraves das RPCs SECURITY DEFINER
-- increment_partner_profile_view/increment_partner_contact_click abaixo,
-- nunca por uma escrita direta do cliente.

-- ============ INCREMENT_PARTNER_PROFILE_VIEW ============
-- Recriada com EXATAMENTE o mesmo corpo/assinatura de hoje (ver
-- 20260715160400_rpc-rate-limiting.sql), apenas com o INSERT ... ON CONFLICT
-- em partner_metric_daily adicionado apos o UPDATE em profiles.
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

  INSERT INTO public.partner_metric_daily (partner_id, day, views)
  VALUES (_partner_id, CURRENT_DATE, 1)
  ON CONFLICT (partner_id, day) DO UPDATE
    SET views = public.partner_metric_daily.views + 1;
END;
$$;

-- ============ INCREMENT_PARTNER_CONTACT_CLICK ============
-- Recriada com EXATAMENTE o mesmo corpo/assinatura de hoje (ver
-- 20260715160400_rpc-rate-limiting.sql), apenas com o INSERT ... ON CONFLICT
-- em partner_metric_daily adicionado apos o UPDATE em profiles.
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

  INSERT INTO public.partner_metric_daily (partner_id, day, contact_clicks)
  VALUES (_partner_id, CURRENT_DATE, 1)
  ON CONFLICT (partner_id, day) DO UPDATE
    SET contact_clicks = public.partner_metric_daily.contact_clicks + 1;

  RETURN COALESCE(new_count, 0);
END;
$$;
