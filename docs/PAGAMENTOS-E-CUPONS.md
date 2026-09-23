# Pagamentos (Pix / cartão) e Cupons — planejamento (frente futura)

> Respostas aos itens 3 e 4 levantados após a loja virtual (#8). NÃO
> implementado ainda — é uma frente própria, grande, com implicações de
> conformidade de loja. Este doc registra o que é necessário para quando for
> a hora.

## Item 3 — Compra com Pix / cartão de crédito/débito

Para vender de verdade dentro do app é preciso:

1. **Gateway de pagamento (PSP)** — não se processa cartão/Pix manualmente.
   Opções fortes no Brasil: **Mercado Pago**, **Stripe**, **Pagar.me/Stone**,
   **Asaas/AbacatePay** (Pix). Eles fornecem: cobrança Pix (QR + copia-e-cola),
   tokenização de cartão e **webhook** de confirmação.
2. **Conta + credenciais** do PSP (chaves de API), CNPJ/conta para receber.
3. **Backend/Edge Function (Supabase)** — a chave secreta do PSP NUNCA fica no
   app. Uma Edge Function cria a cobrança e outra recebe o **webhook** de
   "pago" e marca o pedido. (No stack atual: Supabase Edge Functions em Deno.)
4. **Modelo de dados**: `products` (o que o parceiro vende), `orders` (pedido),
   `payments` (status pago/pendente/estornado). Repasse ao parceiro exige
   **split/marketplace** do PSP (mais complexo).
5. **⚠️ Regras das lojas (crítico)**:
   - Apple/Google exigem **IAP (comissão 15–30%)** para **bens/serviços
     digitais**.
   - **Serviços/bens do mundo real** (guia, passeio, aluguel de bike,
     hospedagem) **podem** usar pagamento externo (Pix/cartão via PSP) sem IAP.
   - O OutVitar vende serviços de parceiros do mundo real → provável exceção,
     mas **precisa ser declarado corretamente na submissão** senão a Apple
     reprova.

**Recomendação**: começar com **um PSP** e **Pix** (mais simples/barato que
cartão), com uma Edge Function de cobrança + webhook.

## Item 4 — Cupom de desconto

Depende do checkout (item 3). Modelo típico:
- `coupons` (código, tipo `percent`/`fixed`, valor, validade, limite de usos,
  parceiro dono, valor mínimo).
- Validação no momento de gerar a cobrança (aplica o desconto antes de enviar
  o valor ao PSP).
- `coupon_redemptions` (registro de uso, para respeitar o limite).

É simples de modelar; o trabalho pesado é o checkout (item 3).

## Estado atual (o que já existe)

A loja virtual (#8) hoje é de **divulgação/lead**: campanhas do parceiro
aparecem no Iniciar e (opcional) na Comunidade e no sininho, com um botão que
leva ao **link externo** do parceiro (site/WhatsApp/loja). A venda em si
acontece fora do app. Adicionar checkout nativo (Pix/cartão) é o próximo passo
desta linha, quando o negócio exigir.
