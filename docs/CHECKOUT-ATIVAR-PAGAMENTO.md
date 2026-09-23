# Checkout (Pix/cartão) + Cupons — como ATIVAR quando tiver o gateway

> A estrutura está PRONTA e rodando em **modo simulado** (o pedido nasce
> `pending`, o app mostra a tela de pagamento com um Pix de exemplo NÃO
> pagável). Para tornar o pagamento real, siga os passos abaixo.

## O que já existe (feito)

- **Tabelas**: `orders`, `coupons`, `coupon_redemptions` (migrations
  `20260924120000_checkout-pix-cupom.sql` e `20260924130000_coupons-admin.sql`).
- **RPCs**: `create_order`, `validate_coupon`, `my_orders`, `campaign_price_cents`,
  `admin_list_coupons`, `admin_upsert_coupon`, `admin_delete_coupon`,
  `increment_coupon_redemptions`.
- **Telas**: `/checkout/$campaignId` (resumo + cupom + Pix/cartão),
  `/pagamento/$orderId` (QR Pix + status, polling), `/pedidos` (meus pedidos).
  Botão "Comprar" na tela de oferta quando a campanha tem preço.
- **Edge Functions** (esqueleto, em `supabase/functions/`):
  - `payment-create` — cria a cobrança no PSP a partir do pedido.
  - `payment-webhook` — recebe a confirmação e marca o pedido `paid` (+ consome cupom).
  - `_shared/psp.ts` — adaptador agnóstico (modo simulado + espaço para o PSP real).

## Passos para ativar o pagamento real

1. **Escolher o PSP** (gateway). Sugestões p/ Pix no Brasil: Mercado Pago,
   Asaas, AbacatePay. Criar conta, CNPJ/conta bancária, pegar a **API key**.

2. **Implementar o adaptador** em `supabase/functions/_shared/psp.ts`:
   - Preencher `createCharge()` para o provedor (há um exemplo comentado do
     Mercado Pago). Deve retornar `chargeId`, `status` e, para Pix, o
     `pixQrCode` (copia-e-cola) e `pixQrImage`.
   - Preencher `parseWebhook()` para extrair `{ orderId, status }` do corpo do
     webhook do provedor (normalmente via `external_reference` = orderId).

3. **Deploy das Edge Functions** (precisa do Supabase CLI):
   ```
   supabase functions deploy payment-create
   supabase functions deploy payment-webhook --no-verify-jwt
   ```

4. **Configurar as env vars** no dashboard do Supabase (Edge Functions →
   Secrets):
   - `PSP_PROVIDER` = ex. `mercadopago`
   - `PSP_API_KEY` = chave secreta do PSP
   - `PSP_WEBHOOK_SECRET` = segredo p/ validar o webhook (se o PSP oferecer)
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` (já
     disponíveis no ambiente das functions).

5. **Registrar o webhook** no painel do PSP apontando para a URL da função
   `payment-webhook` (`https://<projeto>.supabase.co/functions/v1/payment-webhook`).

6. **Testar**: criar uma oferta com preço, comprar no app, pagar o Pix de
   teste do PSP (sandbox) e conferir se o pedido vira `paid` (o webhook chega
   e a tela de pagamento mostra "confirmado").

## ⚠️ Conformidade de loja (Apple/Google)

- Bens/serviços **digitais** exigem IAP (comissão 15–30%).
- Serviços/bens do **mundo real** (guia, passeio, aluguel, hospedagem) — caso
  do OutVitar — podem usar pagamento externo (Pix/cartão via PSP) sem IAP.
  Declarar corretamente na submissão, senão a Apple pode reprovar.

## Cupons

- Admin cria/edita cupons via RPC `admin_upsert_coupon` (falta a TELA de admin
  de cupons — criar em `/admin/cupons` quando quiser gerenciar pelo app; hoje
  dá para inserir via SQL/RPC). Tipos: `percent` (0-100) ou `fixed` (centavos).
  Limites: valor mínimo, máx. de usos total, usos por usuário, validade,
  parceiro específico.
- O desconto é validado no checkout (`validate_coupon`) e consumido quando o
  pagamento é confirmado (webhook → `coupon_redemptions` + contador).
