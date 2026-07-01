
-- Enum for sharing mode
DO $$ BEGIN
  CREATE TYPE public.location_sharing_mode AS ENUM ('none','friends','public');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Profiles: new fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS location_sharing_mode public.location_sharing_mode NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_location_sharing
  ON public.profiles(location_updated_at)
  WHERE location_sharing_mode <> 'none';

-- Friends table
CREATE TABLE IF NOT EXISTS public.user_friends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID NOT NULL,
  addressee_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_friends_distinct CHECK (requester_id <> addressee_id),
  CONSTRAINT user_friends_unique UNIQUE (requester_id, addressee_id)
);

CREATE INDEX IF NOT EXISTS idx_user_friends_addressee ON public.user_friends(addressee_id);
CREATE INDEX IF NOT EXISTS idx_user_friends_requester ON public.user_friends(requester_id);

ALTER TABLE public.user_friends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view their friendships" ON public.user_friends;
CREATE POLICY "Users view their friendships" ON public.user_friends
  FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

DROP POLICY IF EXISTS "Users create friend requests" ON public.user_friends;
CREATE POLICY "Users create friend requests" ON public.user_friends
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "Users update their friendships" ON public.user_friends;
CREATE POLICY "Users update their friendships" ON public.user_friends
  FOR UPDATE USING (auth.uid() = requester_id OR auth.uid() = addressee_id)
  WITH CHECK (auth.uid() = requester_id OR auth.uid() = addressee_id);

DROP POLICY IF EXISTS "Users delete their friendships" ON public.user_friends;
CREATE POLICY "Users delete their friendships" ON public.user_friends
  FOR DELETE USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Updated_at trigger
DROP TRIGGER IF EXISTS trg_user_friends_updated_at ON public.user_friends;
CREATE TRIGGER trg_user_friends_updated_at
  BEFORE UPDATE ON public.user_friends
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- are_friends helper
CREATE OR REPLACE FUNCTION public.are_friends(_a UUID, _b UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_friends
    WHERE status = 'accepted'
      AND (
        (requester_id = _a AND addressee_id = _b)
        OR (requester_id = _b AND addressee_id = _a)
      )
  );
$$;

-- View for shared locations
DROP VIEW IF EXISTS public.public_user_locations;
CREATE VIEW public.public_user_locations
WITH (security_invoker=on) AS
SELECT
  p.id,
  p.full_name,
  p.username,
  p.avatar_url,
  p.latitude,
  p.longitude,
  p.location_updated_at,
  p.location_sharing_mode
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

GRANT SELECT ON public.public_user_locations TO anon, authenticated;
