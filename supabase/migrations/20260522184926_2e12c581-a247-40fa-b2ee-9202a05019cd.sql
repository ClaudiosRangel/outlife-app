
-- Enrich profiles with partner display fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gallery TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS price TEXT,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC;

-- Security fix: move sensitive contact data to owner-only table
CREATE TABLE IF NOT EXISTS public.profile_contacts (
  id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone TEXT,
  instagram TEXT,
  cnpj TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Migrate existing values
INSERT INTO public.profile_contacts (id, phone, instagram, cnpj)
SELECT id, phone, instagram, cnpj
FROM public.profiles
WHERE phone IS NOT NULL OR instagram IS NOT NULL OR cnpj IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Drop sensitive columns from publicly-readable profiles
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS phone,
  DROP COLUMN IF EXISTS instagram,
  DROP COLUMN IF EXISTS cnpj;

ALTER TABLE public.profile_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their own contacts"
  ON public.profile_contacts FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Owners can insert their own contacts"
  ON public.profile_contacts FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Owners can update their own contacts"
  ON public.profile_contacts FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Owners can delete their own contacts"
  ON public.profile_contacts FOR DELETE
  USING (auth.uid() = id);
