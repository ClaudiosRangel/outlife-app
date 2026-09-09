-- Painel do parceiro: interações (reservas/leads, avaliações recebidas,
-- contador de favoritos) + notificação/push ao parceiro.
--
-- Idempotente. NUNCA editar migrations aplicadas — arquivo novo.

-- ============ 1) Tabela de leads/reservas (interesse individual) ============
-- Cada clique em "Reservar" cria um lead que o parceiro vê no painel (quem se
-- interessou e quando). RLS: o parceiro vê os SEUS leads; quem clica cria o
-- próprio lead.
CREATE TABLE IF NOT EXISTS public.partner_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS partner_leads_partner_idx ON public.partner_leads (partner_id, created_at DESC);
ALTER TABLE public.partner_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partner views own leads" ON public.partner_leads;
CREATE POLICY "Partner views own leads"
  ON public.partner_leads FOR SELECT USING (auth.uid() = partner_id);

DROP POLICY IF EXISTS "User creates own lead" ON public.partner_leads;
CREATE POLICY "User creates own lead"
  ON public.partner_leads FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============ 2) RPC: registrar interesse (lead) + notificar parceiro ======
-- Chamada quando o usuário toca em "Reservar". Cria o lead e uma notification
-- para o parceiro (o trigger de push já leva ao celular dele).
CREATE OR REPLACE FUNCTION public.create_partner_lead(_partner_id UUID, _message TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO public.partner_leads (partner_id, user_id, message)
  VALUES (_partner_id, v_user, _message);

  -- Notifica o parceiro (isolado — falha de notificação não desfaz o lead).
  BEGIN
    INSERT INTO public.notifications (recipient_id, type, payload)
    VALUES (_partner_id, 'partner_lead', jsonb_build_object('userId', v_user));
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_partner_lead(UUID, TEXT) TO authenticated;

-- ============ 3) Notificar parceiro ao receber avaliação ============
-- Trigger AFTER INSERT em reviews: quando a review é de um parceiro, cria uma
-- notification para ele. (O recálculo de rating já é feito por outro trigger.)
CREATE OR REPLACE FUNCTION public.trg_notify_partner_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.partner_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.notifications (recipient_id, type, payload)
      VALUES (NEW.partner_id, 'review_received',
              jsonb_build_object('authorId', NEW.author_id, 'rating', NEW.rating));
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_partner_review ON public.reviews;
CREATE TRIGGER trg_notify_partner_review
  AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_partner_review();

-- ============ 4) RPC: leads do parceiro (com nome/avatar de quem se interessou)
CREATE OR REPLACE FUNCTION public.fetch_partner_leads(_limit INTEGER DEFAULT 50)
RETURNS TABLE (
  id UUID, user_id UUID, full_name TEXT, avatar_url TEXT, message TEXT, created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.id, l.user_id, p.full_name, p.avatar_url, l.message, l.created_at
  FROM public.partner_leads l
  JOIN public.profiles p ON p.id = l.user_id
  WHERE l.partner_id = auth.uid()
  ORDER BY l.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 50), 200));
$$;
GRANT EXECUTE ON FUNCTION public.fetch_partner_leads(INTEGER) TO authenticated;

-- ============ 5) RPC: contador de favoritos do parceiro logado ============
CREATE OR REPLACE FUNCTION public.count_my_partner_favorites()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER FROM public.favorite_partners WHERE partner_id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.count_my_partner_favorites() TO authenticated;
