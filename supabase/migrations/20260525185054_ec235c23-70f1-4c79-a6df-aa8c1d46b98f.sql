
-- 1. Profile XP
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS xp integer NOT NULL DEFAULT 0;

-- 2. Reviews: optional comment, optional image, track awarded xp
ALTER TABLE public.reviews
  ALTER COLUMN comment DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS xp_awarded integer NOT NULL DEFAULT 0;

-- 3. Trigger function: compute & award XP on insert
CREATE OR REPLACE FUNCTION public.award_review_xp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  award integer := 10;
BEGIN
  IF NEW.comment IS NOT NULL AND length(btrim(NEW.comment)) > 0 THEN
    award := 30;
    IF NEW.image_url IS NOT NULL AND length(btrim(NEW.image_url)) > 0 THEN
      award := 50;
    END IF;
  END IF;

  NEW.xp_awarded := award;

  UPDATE public.profiles
     SET xp = COALESCE(xp, 0) + award,
         updated_at = now()
   WHERE id = NEW.author_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_review_xp ON public.reviews;
CREATE TRIGGER trg_award_review_xp
BEFORE INSERT ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.award_review_xp();

-- 4. Review photos bucket (private; readable by anyone with URL via signed URLs OR public read for displayed images)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('review-photos', 'review-photos', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Review photos are publicly readable" ON storage.objects;
CREATE POLICY "Review photos are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'review-photos');

DROP POLICY IF EXISTS "Users upload review photos to own folder" ON storage.objects;
CREATE POLICY "Users upload review photos to own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'review-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users delete own review photos" ON storage.objects;
CREATE POLICY "Users delete own review photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'review-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
