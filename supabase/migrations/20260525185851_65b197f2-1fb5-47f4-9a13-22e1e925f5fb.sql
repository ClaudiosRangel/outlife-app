
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_views integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contact_clicks integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trial_active boolean NOT NULL DEFAULT true;

-- Atomic increment for profile views (callable by anyone, only affects partner profiles)
CREATE OR REPLACE FUNCTION public.increment_partner_profile_view(_partner_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
     SET profile_views = COALESCE(profile_views, 0) + 1,
         updated_at = now()
   WHERE id = _partner_id
     AND role = 'partner';
END;
$$;

-- Atomic increment for contact clicks; closes trial once threshold is met
CREATE OR REPLACE FUNCTION public.increment_partner_contact_click(_partner_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count integer;
BEGIN
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

REVOKE ALL ON FUNCTION public.increment_partner_profile_view(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_partner_profile_view(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.increment_partner_contact_click(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_partner_contact_click(uuid) TO anon, authenticated;
