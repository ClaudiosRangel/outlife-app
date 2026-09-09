-- Recálculo automático de rating/reviews_count ao avaliar (bug: avaliação não
-- incrementava o "0 avaliações" nem as estrelas do parceiro/destino).
--
-- Causa: existia trigger de XP (award_review_xp), mas NENHUM que recalculasse
-- profiles.rating/reviews_count nem destinations.rating. Além disso o trigger
-- protect_profile_trust_fields impede alterar rating/reviews_count por
-- não-admin — por isso o recálculo precisa ser SECURITY DEFINER.
--
-- Idempotente: CREATE OR REPLACE + DROP TRIGGER IF EXISTS. Faz backfill no fim.

-- ============ Função de recálculo ============
-- Recebe o "alvo" (partner_id OU destination_id) da review afetada e recalcula
-- a média e a contagem a partir da tabela reviews. Roda como DEFINER para
-- passar pelo protect_profile_trust_fields.
CREATE OR REPLACE FUNCTION public.recalc_review_aggregates(
  _partner_id UUID,
  _destination_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg NUMERIC;
  v_count INTEGER;
BEGIN
  IF _partner_id IS NOT NULL THEN
    SELECT COALESCE(ROUND(AVG(rating)::numeric, 2), 0), COUNT(*)
      INTO v_avg, v_count
      FROM public.reviews WHERE partner_id = _partner_id;
    UPDATE public.profiles
       SET rating = v_avg, reviews_count = v_count, updated_at = now()
     WHERE id = _partner_id;
  END IF;

  IF _destination_id IS NOT NULL THEN
    SELECT COALESCE(ROUND(AVG(rating)::numeric, 2), 0)
      INTO v_avg
      FROM public.reviews WHERE destination_id = _destination_id;
    UPDATE public.destinations
       SET rating = v_avg
     WHERE id = _destination_id;
  END IF;
END;
$$;

-- ============ Trigger AFTER INSERT/UPDATE/DELETE em reviews ============
CREATE OR REPLACE FUNCTION public.trg_recalc_review_aggregates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Recalcula o alvo da linha nova (INSERT/UPDATE).
  IF TG_OP <> 'DELETE' THEN
    PERFORM public.recalc_review_aggregates(NEW.partner_id, NEW.destination_id);
  END IF;
  -- Em UPDATE/DELETE, também recalcula o alvo antigo (caso tenha mudado).
  IF TG_OP <> 'INSERT' THEN
    PERFORM public.recalc_review_aggregates(OLD.partner_id, OLD.destination_id);
  END IF;
  RETURN NULL; -- AFTER trigger
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_review_aggregates ON public.reviews;
CREATE TRIGGER trg_recalc_review_aggregates
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_review_aggregates();

-- ============ Backfill: recalcula tudo que já tem reviews ============
-- Parceiros
UPDATE public.profiles p
   SET rating = sub.avg_rating, reviews_count = sub.cnt, updated_at = now()
  FROM (
    SELECT partner_id, ROUND(AVG(rating)::numeric, 2) AS avg_rating, COUNT(*) AS cnt
      FROM public.reviews WHERE partner_id IS NOT NULL GROUP BY partner_id
  ) sub
 WHERE p.id = sub.partner_id;

-- Destinos
UPDATE public.destinations d
   SET rating = sub.avg_rating
  FROM (
    SELECT destination_id, ROUND(AVG(rating)::numeric, 2) AS avg_rating
      FROM public.reviews WHERE destination_id IS NOT NULL GROUP BY destination_id
  ) sub
 WHERE d.id = sub.destination_id;
