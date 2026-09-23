// Edge Function: recebe o webhook do PSP quando o pagamento é confirmado
// (ou falha) e atualiza o pedido para 'paid'/'failed'. Também consome o cupom
// (registra a redenção) ao confirmar o pagamento.
//
// Deploy: supabase functions deploy payment-webhook --no-verify-jwt
// (o PSP chama sem JWT; validar por assinatura/segredo do provedor).
// Requer envs: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (+ PSP_* quando real).
//
// Configurar a URL desta função no painel do PSP como endpoint de webhook.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseWebhook, pspProvider } from "../_shared/psp.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = parseWebhook(pspProvider(), body);
    if (!parsed) return new Response("ignored", { status: 200 });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("id", parsed.orderId)
      .maybeSingle();
    if (!order) return new Response("order not found", { status: 200 });

    if (parsed.status === "paid" && order.status !== "paid") {
      await supabase
        .from("orders")
        .update({ status: "paid", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", order.id);

      // Consome o cupom (uma redenção) ao confirmar o pagamento.
      if (order.coupon_id) {
        await supabase.from("coupon_redemptions").insert({
          coupon_id: order.coupon_id,
          user_id: order.user_id,
          order_id: order.id,
        });
        // Incrementa contador do cupom (best-effort via RPC/atualização).
        await supabase.rpc("increment_coupon_redemptions", { _coupon_id: order.coupon_id }).catch(() => {});
      }
    } else if (parsed.status === "failed") {
      await supabase.from("orders").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", order.id);
    }

    return new Response("ok", { status: 200 });
  } catch (e) {
    return new Response((e as Error).message, { status: 500 });
  }
});
