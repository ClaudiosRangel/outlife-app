// Edge Function: cria a cobrança (Pix/cartão) no PSP a partir de um pedido já
// criado (status 'pending') e grava os dados do Pix/charge no pedido.
//
// Chamada pelo app após create_order. Usa a service_role key (nunca exposta ao
// cliente) para atualizar o pedido. Autentica o usuário pelo JWT do header.
//
// Deploy: supabase functions deploy payment-create
// Requer envs: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (+ PSP_* quando real).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createCharge } from "../_shared/psp.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { orderId } = await req.json();
    if (!orderId) return json({ error: "orderId obrigatório" }, 400);

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    // Valida o usuário dono do pedido.
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "não autenticado" }, 401);

    const { data: order, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (error || !order) return json({ error: "pedido não encontrado" }, 404);
    if (order.status !== "pending") return json({ error: "pedido não está pendente" }, 409);

    const charge = await createCharge({
      orderId: order.id,
      amountCents: order.total_cents,
      method: (order.payment_method ?? "pix") as "pix" | "card",
      description: order.title,
      payerEmail: userData.user.email,
    });

    await supabase
      .from("orders")
      .update({
        psp_provider: charge.provider,
        psp_charge_id: charge.chargeId,
        pix_qr_code: charge.pixQrCode ?? null,
        pix_qr_image: charge.pixQrImage ?? null,
        status: charge.status,
        paid_at: charge.status === "paid" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    return json({
      ok: true,
      provider: charge.provider,
      status: charge.status,
      pixQrCode: charge.pixQrCode,
      pixQrImage: charge.pixQrImage,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
