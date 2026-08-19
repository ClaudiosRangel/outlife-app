-- ============================================================
-- Migration consolidada: fixes aplicados manualmente em 19/08/2026
-- Garante que o sistema funciona sem intervenção manual no banco.
-- ============================================================

-- 1. Policy de leitura da tabela admin_emails (admin/destinos)
ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read admin_emails" ON public.admin_emails;
CREATE POLICY "Authenticated users can read admin_emails"
  ON public.admin_emails
  FOR SELECT
  TO authenticated
  USING (true);

-- 2. Admins na tabela user_roles (para RLS de UPDATE em destinations)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role_enum
FROM auth.users
WHERE email IN (
  'claudiosilvarangel1974@gmail.com',
  'caioestevesrangel14@gmail.com',
  'rafa.tom@gmail.com'
)
ON CONFLICT (user_id, role) DO NOTHING;

-- 3. Policy de destinations: admins veem TODOS (incluindo pending de outros)
DROP POLICY IF EXISTS "Approved destinations are public" ON public.destinations;
CREATE POLICY "Approved destinations are public"
  ON public.destinations FOR SELECT
  USING (
    status = 'approved'::destination_status
    OR auth.uid() = created_by
    OR public.is_admin(auth.uid())
  );

-- 4. Policy de INSERT em cadastur_verification_requests (publicação direta)
DROP POLICY IF EXISTS "Partners can submit cadastur requests" ON public.cadastur_verification_requests;
CREATE POLICY "Partners can submit cadastur requests"
  ON public.cadastur_verification_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = partner_id);

-- 5. Storage: permitir upload de imagens de eventos e compliance
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND schemaname = 'storage' 
    AND policyname = 'Users can upload event images'
  ) THEN
    CREATE POLICY "Users can upload event images"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'community-post-images' 
      AND (storage.foldername(name))[1] = 'events'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND schemaname = 'storage' 
    AND policyname = 'Users can upload compliance images'
  ) THEN
    CREATE POLICY "Users can upload compliance images"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'community-post-images' 
      AND (storage.foldername(name))[1] = 'compliance'
    );
  END IF;
END $$;

-- 6. Campo meeting_point na tabela events
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS meeting_point TEXT;

-- 7. Function promote_to_partner (bypass trigger de proteção)
CREATE OR REPLACE FUNCTION public.promote_to_partner(
  _user_id UUID,
  _full_name TEXT DEFAULT NULL,
  _avatar_url TEXT DEFAULT NULL,
  _description TEXT DEFAULT NULL,
  _category TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Desabilita trigger temporariamente para permitir alteração de role
  ALTER TABLE public.profiles DISABLE TRIGGER protect_profile_trust_fields_trg;
  
  UPDATE public.profiles
  SET role = 'partner',
      is_verified = true,
      full_name = COALESCE(_full_name, full_name),
      avatar_url = COALESCE(_avatar_url, avatar_url),
      description = COALESCE(_description, description),
      category = COALESCE(_category, category)
  WHERE id = _user_id;
  
  ALTER TABLE public.profiles ENABLE TRIGGER protect_profile_trust_fields_trg;
END;
$$;

-- 8. Atualizar admin_emails (trocar rafael antigo por novo)
UPDATE public.admin_emails
SET email = 'rafa.tom@gmail.com'
WHERE email = 'rafaelcv.166096@uniacademia.edu.br';
