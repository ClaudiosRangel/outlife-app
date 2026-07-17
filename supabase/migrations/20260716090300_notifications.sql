-- Notification: tabela, RLS e trigger de criacao a partir de solicitacao de amizade.
--
-- Requirements: 9.1, 9.2

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'friend_request', extensivel no futuro
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX notifications_recipient_idx ON public.notifications (recipient_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = recipient_id);

CREATE POLICY "Users update read state of their own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- Nenhuma policy de INSERT e criada de proposito: a criacao de Notification
-- ocorre exclusivamente via a funcao SECURITY DEFINER `notify_on_friend_request`
-- (chamada pelo trigger abaixo), nunca por uma escrita direta do cliente. Isso
-- garante que um usuario nao possa forjar uma notificacao para outro usuario
-- (Requirement 9.1).

-- ============ NOTIFY_ON_FRIEND_REQUEST ============
CREATE OR REPLACE FUNCTION public.notify_on_friend_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    INSERT INTO public.notifications (recipient_id, type, payload)
    VALUES (
      NEW.addressee_id,
      'friend_request',
      jsonb_build_object('requesterId', NEW.requester_id, 'friendshipId', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_friend_request ON public.user_friends;
CREATE TRIGGER trg_notify_on_friend_request
  AFTER INSERT ON public.user_friends
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_friend_request();
