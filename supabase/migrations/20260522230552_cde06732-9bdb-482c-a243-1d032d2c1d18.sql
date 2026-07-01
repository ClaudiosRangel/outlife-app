
-- Helper: check if user is a partner via profiles table
CREATE OR REPLACE FUNCTION public.is_partner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND role = 'partner'::app_role
  )
$$;

-- 1. Services policies require partner role
DROP POLICY IF EXISTS "Partners can create their own services" ON public.services;
DROP POLICY IF EXISTS "Partners can update their own services" ON public.services;
DROP POLICY IF EXISTS "Partners can delete their own services" ON public.services;

CREATE POLICY "Partners can create their own services"
  ON public.services FOR INSERT
  WITH CHECK (
    auth.uid() = partner_id
    AND (public.is_partner(auth.uid()) OR public.is_admin(auth.uid()))
  );

CREATE POLICY "Partners can update their own services"
  ON public.services FOR UPDATE
  USING (
    auth.uid() = partner_id
    AND (public.is_partner(auth.uid()) OR public.is_admin(auth.uid()))
  );

CREATE POLICY "Partners can delete their own services"
  ON public.services FOR DELETE
  USING (
    auth.uid() = partner_id
    AND (public.is_partner(auth.uid()) OR public.is_admin(auth.uid()))
  );

-- 2. Reviews: prevent self-review
DROP POLICY IF EXISTS "Users can create reviews" ON public.reviews;
CREATE POLICY "Users can create reviews"
  ON public.reviews FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND (partner_id IS NULL OR partner_id <> auth.uid())
  );

-- 3. Community post counters protection
CREATE OR REPLACE FUNCTION public.prevent_post_counter_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.likes := OLD.likes;
  NEW.comments_count := OLD.comments_count;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lock_community_post_counters ON public.community_posts;
CREATE TRIGGER lock_community_post_counters
  BEFORE UPDATE ON public.community_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_post_counter_tampering();

-- 4. partner-gallery storage hardening
DROP POLICY IF EXISTS "Partner gallery is public readable" ON storage.objects;

UPDATE storage.buckets
  SET allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp']
  WHERE id = 'partner-gallery';
