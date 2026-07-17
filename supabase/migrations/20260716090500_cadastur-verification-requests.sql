-- Migration F: `cadastur_verification_requests` + bucket `compliance-documents`
-- + funções de decisão (Requirement 11).
-- Tabela de submissão de compliance Cadastur pelo parceiro, com no máximo uma
-- solicitação `pending` por parceiro (índice único parcial), RLS restringindo
-- leitura ao próprio parceiro/admin, insert ao próprio parceiro e update a
-- admins, e um bucket privado para o documento comprobatório, seguindo o
-- mesmo padrão de pasta-por-usuário de `partner-gallery`/`avatars`, porém sem
-- policy pública de leitura (apenas o próprio owner e admins).

CREATE TYPE public.cadastur_request_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.cadastur_verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  cadastur_number TEXT NOT NULL,
  category TEXT NOT NULL,
  responsible TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  description TEXT NOT NULL,
  document_url TEXT NOT NULL,
  status public.cadastur_request_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Garante Requirement 11.9: no máximo uma solicitação pending por parceiro.
CREATE UNIQUE INDEX cadastur_requests_one_pending_per_partner
  ON public.cadastur_verification_requests (partner_id)
  WHERE status = 'pending';

ALTER TABLE public.cadastur_verification_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners view their own requests"
  ON public.cadastur_verification_requests FOR SELECT
  USING (auth.uid() = partner_id OR public.is_admin(auth.uid()));

CREATE POLICY "Partners create their own pending request"
  ON public.cadastur_verification_requests FOR INSERT
  WITH CHECK (auth.uid() = partner_id AND status = 'pending');

CREATE POLICY "Admins update requests"
  ON public.cadastur_verification_requests FOR UPDATE
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Bucket privado para o documento comprobatório do Cadastur: apenas o
-- próprio parceiro (upload/leitura da própria pasta) e admins (leitura de
-- qualquer pasta) têm acesso.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('compliance-documents', 'compliance-documents', false, 5242880, ARRAY['image/jpeg','image/png','application/pdf'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Owners can read their own compliance documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'compliance-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can read all compliance documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'compliance-documents' AND public.is_admin(auth.uid()));

CREATE POLICY "Owners can upload to their compliance documents folder"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'compliance-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners can update their compliance documents"
ON storage.objects FOR UPDATE
USING (bucket_id = 'compliance-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners can delete their compliance documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'compliance-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Funções de decisão do admin. A checagem de `is_admin` é explícita
-- (redundante com a RLS de UPDATE da tabela) porque estas funções também
-- escrevem em `profiles.is_verified`, que não é protegida pela policy de
-- UPDATE de `cadastur_verification_requests` acima.
CREATE OR REPLACE FUNCTION public.approve_cadastur_request(_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _partner_id uuid;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE public.cadastur_verification_requests
    SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
    WHERE id = _id AND status = 'pending'
    RETURNING partner_id INTO _partner_id;
  IF _partner_id IS NOT NULL THEN
    UPDATE public.profiles SET is_verified = true WHERE id = _partner_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_cadastur_request(_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE public.cadastur_verification_requests
    SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
    WHERE id = _id AND status = 'pending';
END;
$$;
