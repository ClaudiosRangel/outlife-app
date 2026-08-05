-- Cria as tabelas Native_Push_Token e Web_Push_Subscription, usadas pelo
-- registro de dispositivos/navegadores para receber Push_Notification
-- (Requirements 11.1, 11.2 do spec app-hibrido-nativo).
--
-- `native_push_tokens`: um token por dispositivo (FCM/APNs), obtido
-- exclusivamente quando a OutLife_Application é executada dentro do
-- Outlife_Native_Shell. `UNIQUE (user_id, device_id)` permite múltiplos
-- dispositivos por usuário sem duplicar o registro do mesmo dispositivo.
--
-- `web_push_subscriptions`: uma subscription por navegador (padrão Web
-- Push), obtida fora do shell nativo. `UNIQUE (user_id, endpoint)` evita
-- duplicar a mesma subscription.
--
-- Ambas com RLS restrita ao próprio usuário (`auth.uid() = user_id`), sem
-- exceção — nenhum outro usuário ou papel deve ler/escrever essas linhas
-- diretamente pelo cliente.

CREATE TABLE public.native_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios')),
  device_id TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)
);

ALTER TABLE public.native_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own native push tokens"
  ON public.native_push_tokens FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.web_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

ALTER TABLE public.web_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own web push subscriptions"
  ON public.web_push_subscriptions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
