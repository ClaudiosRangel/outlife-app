-- Cria o disparo centralizado de Push_Notification a partir da criação de
-- uma Notification in-app (Requirements 11.3, 11.4, 11.6 do spec
-- app-hibrido-nativo).
--
-- `fn_dispatch_push_notification` é um trigger AFTER INSERT em
-- `public.notifications`: para cada linha inserida, itera os
-- Native_Push_Token e Web_Push_Subscription ativos do destinatário
-- (`NEW.recipient_id`) e dispara o envio correspondente. Cada envio
-- individual é isolado em seu próprio bloco `BEGIN...EXCEPTION WHEN OTHERS
-- THEN NULL` — uma falha em um token/subscription nunca aborta a
-- transação nem impede os demais envios (Requirement 11.3), e nunca desfaz
-- a criação da Notification in-app, que já ocorreu antes deste trigger
-- AFTER INSERT disparar.
--
-- Colunas de `public.notifications` confirmadas em
-- `20260716090300_notifications.sql`: `recipient_id` (destinatário) e
-- `type` (tipo do evento), reaproveitadas aqui sem alteração.
--
-- `fn_send_native_push`/`fn_send_web_push` são stubs SECURITY DEFINER que,
-- em produção, disparariam a chamada HTTP via `pg_net` (extensão já
-- disponível no Supabase) para FCM/APNs/Web Push respectivamente. Como a
-- integração real com essas chamadas de rede depende de configuração
-- externa (credenciais FCM/APNs, chaves VAPID) fora do escopo desta
-- migration, os stubs abaixo registram a intenção de envio via `RAISE
-- NOTICE` — substituí-los pela chamada `pg_net.http_post` real é trabalho
-- operacional subsequente, sem alterar o contrato do trigger.

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
BEGIN
  RAISE NOTICE 'fn_send_native_push: platform=%, type=%', _platform, _type;
END;
$$;

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
  RAISE NOTICE 'fn_send_web_push: type=%', _type;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_dispatch_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  token_row RECORD;
  sub_row RECORD;
BEGIN
  -- Cada envio isolado; falha em um token/subscription nunca aborta a
  -- transação nem impede os demais (Requirement 11.3).
  FOR token_row IN
    SELECT token, platform FROM public.native_push_tokens
    WHERE user_id = NEW.recipient_id AND is_active
  LOOP
    BEGIN
      PERFORM public.fn_send_native_push(token_row.token, token_row.platform, NEW.type, to_jsonb(NEW));
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  FOR sub_row IN
    SELECT endpoint, p256dh, auth FROM public.web_push_subscriptions
    WHERE user_id = NEW.recipient_id AND is_active
  LOOP
    BEGIN
      PERFORM public.fn_send_web_push(sub_row.endpoint, sub_row.p256dh, sub_row.auth, NEW.type, to_jsonb(NEW));
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  RETURN NEW; -- a criação da Notification já ocorreu antes deste trigger AFTER INSERT disparar
END;
$$;

DROP TRIGGER IF EXISTS trg_dispatch_push_notification ON public.notifications;

CREATE TRIGGER trg_dispatch_push_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.fn_dispatch_push_notification();
