-- ============================================================================
-- Chat privado — notificação no sininho ao receber mensagem (ponto 1).
-- Estende send_direct_message para inserir uma notification tipo
-- 'direct_message' para o destinatário, com o nome/ id do remetente no payload.
-- Idempotente (CREATE OR REPLACE, mesma assinatura de retorno).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.send_direct_message(_recipient_id uuid, _text text)
RETURNS public.direct_messages
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _row public.direct_messages;
  _sender_name text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _recipient_id IS NULL OR _recipient_id = _uid THEN
    RAISE EXCEPTION 'invalid recipient';
  END IF;
  IF length(btrim(_text)) = 0 THEN RAISE EXCEPTION 'message is blank'; END IF;

  INSERT INTO public.direct_messages (sender_id, recipient_id, text)
  VALUES (_uid, _recipient_id, btrim(_text))
  RETURNING * INTO _row;

  -- Notifica o destinatário (sininho). Best-effort: se a tabela/trigger de
  -- notifications mudar, não deve derrubar o envio da mensagem.
  BEGIN
    SELECT full_name INTO _sender_name FROM public.profiles WHERE id = _uid;
    INSERT INTO public.notifications (recipient_id, type, payload, is_read)
    VALUES (
      _recipient_id,
      'direct_message',
      jsonb_build_object(
        'sender_id', _uid,
        'sender_name', COALESCE(_sender_name, 'Alguém'),
        'preview', left(btrim(_text), 80)
      ),
      false
    );
  EXCEPTION WHEN OTHERS THEN
    -- ignora falha de notificação; a mensagem já foi persistida
    NULL;
  END;

  RETURN _row;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.send_direct_message(uuid, text) TO authenticated;
