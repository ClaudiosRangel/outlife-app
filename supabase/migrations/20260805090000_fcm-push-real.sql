-- Substitui os stubs de fn_send_native_push/fn_send_web_push por chamadas
-- HTTP reais via pg_net para o endpoint /api/push/send-fcm hospedado na
-- Vercel (mesma instância do app).
--
-- Requer que a extensão pg_net esteja habilitada no Supabase (já está por
-- padrão em projetos Supabase).

-- Habilita pg_net se ainda não estiver
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- URL base do app hospedado na Vercel (produção)
-- Em dev local, trocar para http://localhost:3000
CREATE OR REPLACE FUNCTION public.fn_send_native_push(
  _token TEXT,
  _platform TEXT,
  _type TEXT,
  _payload JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _app_url TEXT := 'https://outlife-app.vercel.app';
  _secret TEXT := 'outlife-push-2026';
BEGIN
  -- Dispara chamada HTTP assíncrona para o endpoint FCM do app
  PERFORM extensions.http_post(
    url := _app_url || '/api/push/send-fcm',
    body := jsonb_build_object(
      'token', _token,
      'type', _type,
      'secret', _secret
    )::text,
    headers := jsonb_build_object('Content-Type', 'application/json')
  );
EXCEPTION WHEN OTHERS THEN
  -- Nunca aborta a transação — push é best-effort
  RAISE NOTICE 'fn_send_native_push falhou: %', SQLERRM;
END;
$$;

-- Web Push ainda como stub (requer implementação com web-push library)
CREATE OR REPLACE FUNCTION public.fn_send_web_push(
  _endpoint TEXT,
  _p256dh TEXT,
  _auth TEXT,
  _type TEXT,
  _payload JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE NOTICE 'fn_send_web_push: type=% (Web Push real pendente de chaves VAPID)', _type;
END;
$$;
