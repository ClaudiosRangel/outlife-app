-- ============================================================================
-- Correção crítica do envio de push nativo (FCM)
-- ============================================================================
-- BUG: fn_send_native_push chamava `extensions.http_post`, que NÃO existe
-- neste projeto — a extensão HTTP disponível é `pg_net` (função net.http_post,
-- com `body` em JSONB, não text). Resultado: toda tentativa de push nativo
-- caía no EXCEPTION silencioso e NENHUM push era enviado ao FCM.
--
-- Correção: usar net.http_post com body JSONB. Idempotente (CREATE OR REPLACE).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_send_native_push(
  _token TEXT, _platform TEXT, _type TEXT, _payload JSONB
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _app_url TEXT := 'https://outlife-app.vercel.app';
  _secret TEXT := 'outlife-push-2026';
BEGIN
  PERFORM net.http_post(
    url := _app_url || '/api/push/send-fcm',
    body := jsonb_build_object(
      'token', _token,
      'type', _type,
      'badge', COALESCE((_payload ->> 'badge')::int, 0),
      'secret', _secret
    ),
    headers := jsonb_build_object('Content-Type', 'application/json')
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'fn_send_native_push falhou: %', SQLERRM;
END; $$;
