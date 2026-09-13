-- ============================================================================
-- Ponto 4: chat privado entre usuários (mesmo sem serem amigos).
-- Tabela direct_messages (1:1) + RLS: cada usuário lê/gerencia só as conversas
-- de que participa. Envio via RPC SECURITY DEFINER (valida remetente).
-- Idempotente.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS direct_messages_pair_idx
  ON public.direct_messages(sender_id, recipient_id, created_at);
CREATE INDEX IF NOT EXISTS direct_messages_recipient_idx
  ON public.direct_messages(recipient_id, read_at);

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Leitura: participante (remetente OU destinatário).
DROP POLICY IF EXISTS "read own conversations" ON public.direct_messages;
CREATE POLICY "read own conversations" ON public.direct_messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- Inserir: só como remetente (auth.uid() = sender_id). Permite mensagem a
-- qualquer usuário (não exige amizade), conforme pedido.
DROP POLICY IF EXISTS "send own messages" ON public.direct_messages;
CREATE POLICY "send own messages" ON public.direct_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id AND sender_id <> recipient_id);

-- Marcar como lida: o destinatário atualiza read_at das mensagens recebidas.
DROP POLICY IF EXISTS "mark received read" ON public.direct_messages;
CREATE POLICY "mark received read" ON public.direct_messages FOR UPDATE
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- RPC: envia mensagem (valida texto não-vazio e destinatário != remetente).
CREATE OR REPLACE FUNCTION public.send_direct_message(_recipient_id uuid, _text text)
RETURNS public.direct_messages
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _row public.direct_messages;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _recipient_id IS NULL OR _recipient_id = _uid THEN
    RAISE EXCEPTION 'invalid recipient';
  END IF;
  IF length(btrim(_text)) = 0 THEN RAISE EXCEPTION 'message is blank'; END IF;

  INSERT INTO public.direct_messages (sender_id, recipient_id, text)
  VALUES (_uid, _recipient_id, btrim(_text))
  RETURNING * INTO _row;
  RETURN _row;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.send_direct_message(uuid, text) TO authenticated;

-- RPC: lista as conversas do usuário (última mensagem por interlocutor +
-- contagem de não-lidas). Retorna dados públicos do interlocutor.
CREATE OR REPLACE FUNCTION public.list_conversations()
RETURNS TABLE (
  other_id uuid,
  full_name text,
  username text,
  avatar_url text,
  last_text text,
  last_at timestamptz,
  unread integer
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  RETURN QUERY
  WITH msgs AS (
    SELECT
      CASE WHEN dm.sender_id = _uid THEN dm.recipient_id ELSE dm.sender_id END AS other,
      dm.text, dm.created_at, dm.read_at, dm.recipient_id
    FROM public.direct_messages dm
    WHERE dm.sender_id = _uid OR dm.recipient_id = _uid
  ),
  ranked AS (
    SELECT other, text, created_at,
           ROW_NUMBER() OVER (PARTITION BY other ORDER BY created_at DESC) AS rn
    FROM msgs
  ),
  unread AS (
    SELECT other, COUNT(*)::int AS cnt
    FROM msgs
    WHERE recipient_id = _uid AND read_at IS NULL
    GROUP BY other
  )
  SELECT r.other, p.full_name, p.username, p.avatar_url, r.text, r.created_at,
         COALESCE(u.cnt, 0)
  FROM ranked r
  JOIN public.profiles p ON p.id = r.other
  LEFT JOIN unread u ON u.other = r.other
  WHERE r.rn = 1
  ORDER BY r.created_at DESC;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.list_conversations() TO authenticated;
