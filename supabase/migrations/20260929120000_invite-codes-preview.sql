-- 20260929120000_invite-codes-preview.sql
-- Códigos de convite (PRÉVIA para admin — beta). Na beta NÃO há gate/paywall:
-- esta tabela + RPCs existem só para o admin gerar/listar códigos, preparando a
-- monetização do lançamento. Nenhum efeito de bloqueio no app do usuário comum.
-- Idempotente. Acesso restrito a admins (is_admin).

CREATE TABLE IF NOT EXISTS public.invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  -- tipo de acesso que o código concederá no futuro (lançamento).
  grant_type TEXT NOT NULL DEFAULT 'year' CHECK (grant_type IN ('year','lifetime')),
  note TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- resgate (preparado para o futuro; na beta ninguém resgata).
  used_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS invite_codes_created_idx ON public.invite_codes(created_at DESC);

ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

-- Só admins leem/gerenciam (escrita/gestão via RPC SECURITY DEFINER).
DROP POLICY IF EXISTS "invite_codes_admin_select" ON public.invite_codes;
CREATE POLICY "invite_codes_admin_select"
  ON public.invite_codes FOR SELECT USING (public.is_admin(auth.uid()));

-- Lista os códigos (admin). Junta o e-mail/nome de quem gerou/usou (via profiles).
CREATE OR REPLACE FUNCTION public.admin_list_invite_codes(_limit int DEFAULT 200)
RETURNS TABLE (
  id uuid,
  code text,
  grant_type text,
  note text,
  created_at timestamptz,
  created_by_name text,
  used_by_name text,
  used_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ic.id, ic.code, ic.grant_type, ic.note, ic.created_at,
         cp.full_name, up.full_name, ic.used_at
  FROM public.invite_codes ic
  LEFT JOIN public.profiles cp ON cp.id = ic.created_by
  LEFT JOIN public.profiles up ON up.id = ic.used_by
  WHERE public.is_admin(auth.uid())
  ORDER BY ic.created_at DESC
  LIMIT greatest(1, least(_limit, 500));
$$;
REVOKE ALL ON FUNCTION public.admin_list_invite_codes(int) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_list_invite_codes(int) TO authenticated;

-- Gera um código de convite (admin). Retorna o código criado. Só admin.
CREATE OR REPLACE FUNCTION public.admin_generate_invite_code(
  _grant_type text DEFAULT 'year',
  _note text DEFAULT NULL
) RETURNS TABLE (id uuid, code text, grant_type text, note text, created_at timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _code text; _try int := 0;
BEGIN
  IF NOT public.is_admin(_uid) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF coalesce(_grant_type,'year') NOT IN ('year','lifetime') THEN _grant_type := 'year'; END IF;
  LOOP
    -- Código legível: OUTV-XXXXXX (6 chars alfanuméricos sem ambíguos).
    _code := 'OUTV-' || upper(substr(translate(encode(gen_random_bytes(6),'base64'),'+/=OoIl01','ABCDEFGH'), 1, 6));
    BEGIN
      INSERT INTO public.invite_codes (code, grant_type, note, created_by)
      VALUES (_code, _grant_type, nullif(btrim(coalesce(_note,'')),''), _uid);
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      _try := _try + 1;
      IF _try > 8 THEN RAISE EXCEPTION 'could not generate unique code'; END IF;
    END;
  END LOOP;
  RETURN QUERY
    SELECT ic.id, ic.code, ic.grant_type, ic.note, ic.created_at
    FROM public.invite_codes ic WHERE ic.code = _code;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_generate_invite_code(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_generate_invite_code(text, text) TO authenticated;

-- Exclui um código não usado (admin).
CREATE OR REPLACE FUNCTION public.admin_delete_invite_code(_id uuid)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  DELETE FROM public.invite_codes WHERE id = _id AND used_by IS NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_delete_invite_code(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_delete_invite_code(uuid) TO authenticated;
