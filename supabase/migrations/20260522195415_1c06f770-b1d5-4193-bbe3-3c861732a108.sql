-- 1. Move cadastur_number from public profiles to private profile_contacts
ALTER TABLE public.profile_contacts ADD COLUMN IF NOT EXISTS cadastur_number text;

INSERT INTO public.profile_contacts (id, cadastur_number)
SELECT id, cadastur_number FROM public.profiles WHERE cadastur_number IS NOT NULL
ON CONFLICT (id) DO UPDATE SET cadastur_number = EXCLUDED.cadastur_number;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS cadastur_number;

-- 2. Defense-in-depth: destinations default to 'pending'
ALTER TABLE public.destinations ALTER COLUMN status SET DEFAULT 'pending'::destination_status;