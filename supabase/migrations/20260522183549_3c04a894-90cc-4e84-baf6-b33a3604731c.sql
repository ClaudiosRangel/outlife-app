-- Permitir avaliações para destinos OU parceiros
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.reviews
  ALTER COLUMN destination_id DROP NOT NULL;

-- Garantir que exatamente um dos dois alvos esteja preenchido
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reviews_target_exactly_one'
  ) THEN
    ALTER TABLE public.reviews
      ADD CONSTRAINT reviews_target_exactly_one
      CHECK ((destination_id IS NOT NULL)::int + (partner_id IS NOT NULL)::int = 1);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_reviews_partner_id ON public.reviews(partner_id);
CREATE INDEX IF NOT EXISTS idx_reviews_destination_id ON public.reviews(destination_id);