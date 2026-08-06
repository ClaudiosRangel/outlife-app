-- Function SECURITY DEFINER para criar notificação de destino aprovado.
-- Chamada pelo admin ao aprovar um destino na tela de moderação.
-- Não depende de policy de INSERT (que não existe para notifications),
-- pois executa como definer.

CREATE OR REPLACE FUNCTION public.notify_destination_approved(
  _recipient_id UUID,
  _destination_id UUID,
  _destination_name TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (recipient_id, type, payload)
  VALUES (
    _recipient_id,
    'destination_approved',
    jsonb_build_object('destinationId', _destination_id, 'destinationName', _destination_name)
  );
END;
$$;
