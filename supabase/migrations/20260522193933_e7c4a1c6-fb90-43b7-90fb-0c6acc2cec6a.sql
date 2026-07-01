
-- 1) Roles infrastructure (for admin moderation)
DO $$ BEGIN
  CREATE TYPE public.app_role_enum AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role_enum NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User roles are viewable by owner" ON public.user_roles;
CREATE POLICY "User roles are viewable by owner"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role_enum)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::public.app_role_enum)
$$;

-- 2) Destinations: prevent self-approval
DROP POLICY IF EXISTS "Creators can update their pending destinations" ON public.destinations;
CREATE POLICY "Creators can update their pending destinations"
  ON public.destinations FOR UPDATE
  USING (auth.uid() = created_by AND status = 'pending'::destination_status)
  WITH CHECK (auth.uid() = created_by AND status = 'pending'::destination_status);

DROP POLICY IF EXISTS "Admins can moderate destinations" ON public.destinations;
CREATE POLICY "Admins can moderate destinations"
  ON public.destinations FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 3) Profiles: prevent self-inflation of trust signals via trigger
CREATE OR REPLACE FUNCTION public.protect_profile_trust_fields()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  NEW.is_verified := OLD.is_verified;
  NEW.rating := OLD.rating;
  NEW.reviews_count := OLD.reviews_count;
  NEW.followers_count := OLD.followers_count;
  NEW.following_count := OLD.following_count;
  NEW.level := OLD.level;
  NEW.progress_to_next_level := OLD.progress_to_next_level;
  NEW.role := OLD.role;
  NEW.status := OLD.status;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_trust_fields_trg ON public.profiles;
CREATE TRIGGER protect_profile_trust_fields_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_trust_fields();

-- Tighten UPDATE policy with WITH CHECK for row ownership
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
