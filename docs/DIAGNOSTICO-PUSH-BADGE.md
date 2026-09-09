# Diagnóstico — Push notifications e badge do ícone

Sintoma: o número de notificações não aparece no ícone do app nem na central
de notificações do celular. Isso indica que **o push não está chegando ao
dispositivo** (o badge é só a última etapa; se o push não chega, o badge
também não).

A cadeia completa do push é:
`notifications` (INSERT) → trigger `trg_dispatch_push_notification` →
`fn_send_native_push` → `pg_net.http_post` → `/api/push/send-fcm` (Vercel) →
FCM → aparelho.

Se qualquer elo falhar, nada chega. Diagnostique na ordem:

## 1. O aparelho registrou um token de push? (SQL Editor)

```sql
-- Troque pelo SEU e-mail de teste
SELECT t.platform, t.is_active, t.created_at
FROM public.native_push_tokens t
JOIN auth.users u ON u.id = t.user_id
WHERE u.email = 'SEU_EMAIL@exemplo.com'
ORDER BY t.created_at DESC;
```
- **Sem linhas** → o app nunca registrou o token neste device. Causas:
  - Permissão de notificação NÃO concedida (o app pede na 1ª vez; se negou,
    reative nas Configurações do celular → Notificações → OutVitar).
  - O endpoint `/api/push/register-native` não gravou. Ver item 4.
- **Com linha `is_active = true`** → token existe; o problema é adiante.

## 2. Existe notificação sendo criada? (SQL Editor)

```sql
SELECT recipient_id, type, is_read, created_at
FROM public.notifications
ORDER BY created_at DESC
LIMIT 10;
```
- Se **não há linhas** ao curtir/avaliar/reservar → o gatilho que cria a
  notification não está rodando (ex.: a migration do item 11 não foi aplicada).
  Rode `supabase/migrations-pendentes.sql` inteiro.

## 3. A extensão pg_net está ativa e o http_post foi disparado?

```sql
-- pg_net precisa estar habilitado (o item 12 do migrations-pendentes faz isso)
SELECT * FROM pg_extension WHERE extname = 'pg_net';
-- Requisições recentes disparadas:
SELECT id, url, status_code, created FROM net._http_response ORDER BY created DESC LIMIT 10;
```
- Se a URL `.../api/push/send-fcm` aparece com `status_code = 200` → chegou na
  Vercel e o FCM respondeu OK; problema é no device/permissão (item 1) ou no
  Firebase (APNs para iOS).
- `status_code = 401` → secret errado. `503` → FIREBASE_SERVICE_ACCOUNT não
  configurado na Vercel. `500` → erro no envio FCM (ver logs da Vercel).

## 4. FIREBASE_SERVICE_ACCOUNT na Vercel

O endpoint `/api/push/send-fcm` precisa da env var `FIREBASE_SERVICE_ACCOUNT`
(JSON da service account do Firebase) configurada no dashboard da Vercel
(Settings → Environment Variables). Sem ela, retorna 503 "FCM não configurado".

## 5. iOS especificamente (badge + push)

- iOS exige **APNs** configurado no Firebase (chave .p8 APNs Auth Key no
  Firebase Console → Cloud Messaging → Apple app configuration). Sem isso, o
  FCM não entrega push para iPhones.
- O **badge** no iOS depende de `aps.badge` (já enviado pelo endpoint) E da
  permissão de badge concedida. Em app instalado via APK/dev pode não valer —
  o teste real de badge iOS é com build via TestFlight/Codemagic (Bloco H).
- Em **APK Android** de debug, o badge do launcher depende do launcher do
  fabricante (alguns só mostram "ponto", não número).

## Resumo do que é código vs config

- **Código (já feito):** payload FCM com `notification_count`/`aps.badge`;
  tipos de notificação (partner_lead, review_received, etc.); trigger de
  dispatch com contagem de não-lidas.
- **Config (você/produção):** rodar o SQL no Supabase; `FIREBASE_SERVICE_ACCOUNT`
  na Vercel; APNs no Firebase (iOS); permissão de notificação no device.

O teste mais confiável de push+badge no iPhone é com o build assinado via
Codemagic (Bloco H) — no ambiente de dev/APK há limitações do launcher e do
APNs que mascaram o resultado.
