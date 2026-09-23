// Adaptador de PSP (gateway de pagamento) — agnóstico. Enquanto não houver
// credenciais configuradas (env), roda em MODO SIMULADO: gera uma cobrança
// "fake" pendente para o app conseguir exibir a tela de pagamento. Quando o
// PSP for escolhido, implementar `createPixCharge`/`createCardCharge` e o
// parse do webhook para o provedor real (Mercado Pago, Asaas, AbacatePay...).
//
// Variáveis de ambiente esperadas (configurar no dashboard do Supabase quando
// tiver o PSP):
//   PSP_PROVIDER   = 'mercadopago' | 'asaas' | 'abacatepay' | ''(vazio = simulado)
//   PSP_API_KEY    = chave secreta do PSP
//   PSP_WEBHOOK_SECRET = segredo para validar o webhook (quando aplicável)

export interface ChargeInput {
  orderId: string;
  amountCents: number;
  method: "pix" | "card";
  description: string;
  payerEmail?: string | null;
}

export interface ChargeResult {
  provider: string;
  chargeId: string;
  status: "pending" | "paid" | "failed";
  pixQrCode?: string | null;   // copia-e-cola
  pixQrImage?: string | null;  // data URL / URL da imagem
}

export function pspProvider(): string {
  return (Deno.env.get("PSP_PROVIDER") ?? "").trim();
}

export function pspConfigured(): boolean {
  return pspProvider().length > 0 && (Deno.env.get("PSP_API_KEY") ?? "").length > 0;
}

/**
 * Cria uma cobrança no PSP. MODO SIMULADO quando não configurado: retorna uma
 * cobrança pendente com um Pix "copia-e-cola" de exemplo (NÃO pagável), só
 * para o fluxo/telas funcionarem em desenvolvimento.
 */
export async function createCharge(input: ChargeInput): Promise<ChargeResult> {
  const provider = pspProvider();

  if (!pspConfigured()) {
    // ---- MODO SIMULADO (sem PSP) ----
    return {
      provider: "simulado",
      chargeId: `sim_${input.orderId}`,
      status: "pending",
      pixQrCode:
        input.method === "pix"
          ? `00020126SIMULADO-${input.orderId}-${input.amountCents}5204000053039865802BR6009OUTVITAR62070503***6304`
          : null,
      pixQrImage: null,
    };
  }

  // ---- PSP REAL (implementar por provedor) ----
  // Exemplo de esqueleto para plugar (pseudo):
  //
  // if (provider === "mercadopago") {
  //   const res = await fetch("https://api.mercadopago.com/v1/payments", {
  //     method: "POST",
  //     headers: {
  //       Authorization: `Bearer ${Deno.env.get("PSP_API_KEY")}`,
  //       "Content-Type": "application/json",
  //     },
  //     body: JSON.stringify({
  //       transaction_amount: input.amountCents / 100,
  //       description: input.description,
  //       payment_method_id: input.method === "pix" ? "pix" : "master",
  //       payer: { email: input.payerEmail ?? "comprador@outvitar.app" },
  //       external_reference: input.orderId,
  //     }),
  //   });
  //   const data = await res.json();
  //   return {
  //     provider,
  //     chargeId: String(data.id),
  //     status: data.status === "approved" ? "paid" : "pending",
  //     pixQrCode: data.point_of_interaction?.transaction_data?.qr_code ?? null,
  //     pixQrImage: data.point_of_interaction?.transaction_data?.qr_code_base64
  //       ? `data:image/png;base64,${data.point_of_interaction.transaction_data.qr_code_base64}`
  //       : null,
  //   };
  // }
  //
  // Repetir o padrão para asaas/abacatepay conforme a doc de cada um.

  throw new Error(`PSP '${provider}' ainda não implementado. Configure o adaptador em _shared/psp.ts.`);
}

/**
 * Interpreta o corpo do webhook do PSP e retorna { orderId, status }.
 * Implementar por provedor. No modo simulado, aceita { orderId, status }.
 */
export function parseWebhook(provider: string, body: unknown): { orderId: string; status: ChargeResult["status"] } | null {
  const b = body as Record<string, unknown>;
  if (!provider || provider === "simulado") {
    if (typeof b?.orderId === "string" && typeof b?.status === "string") {
      return { orderId: b.orderId as string, status: b.status as ChargeResult["status"] };
    }
    return null;
  }
  // if (provider === "mercadopago") { ... extrair external_reference + status ... }
  return null;
}
