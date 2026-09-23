import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ChevronLeft, Copy, CheckCircle2, Clock, QrCode, XCircle } from "lucide-react";
import { StatusBar } from "@/components/StatusBar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { fetchOrderById, formatCents } from "@/lib/api";

export const Route = createFileRoute("/pagamento/$orderId")({
  component: PaymentPage,
  head: () => ({
    meta: [
      { title: "Pagamento — OutVitar" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/pagamento" }],
  }),
});

function PaymentPage() {
  const { orderId } = Route.useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Poll do status a cada 5s (o webhook do PSP marca 'paid' no backend).
  const { data: order, isLoading } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => fetchOrderById(orderId),
    refetchInterval: (q) => {
      const s = (q.state.data as { status?: string } | undefined)?.status;
      return s === "paid" || s === "failed" || s === "canceled" ? false : 5000;
    },
  });

  if (isLoading) {
    return (
      <div className="animate-float-up pb-24">
        <StatusBar />
        <div className="mx-5 mt-4 space-y-3"><Skeleton className="h-56 w-full rounded-2xl" /></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <h1 className="text-lg font-semibold">{t("payment.notFound", "Pedido não encontrado.")}</h1>
        <button onClick={() => navigate({ to: "/perfil" })} className="mt-4 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">
          {t("common.back", "Voltar")}
        </button>
      </div>
    );
  }

  const copyPix = async () => {
    if (!order.pix_qr_code) return;
    try {
      await navigator.clipboard.writeText(order.pix_qr_code);
      toast.success(t("payment.copied", "Código Pix copiado!"));
    } catch {
      toast.error(t("common.shareError", "Não foi possível copiar."));
    }
  };

  const simulated = order.psp_provider === "simulado" || !order.psp_provider;

  return (
    <div className="flex min-h-screen flex-col pb-6">
      <div className="bg-gradient-forest px-5 pb-4 text-white">
        <StatusBar light />
        <div className="flex items-center gap-3 pt-2">
          <button onClick={() => navigate({ to: "/perfil" })} className="grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur-md">
            <ChevronLeft size={18} />
          </button>
          <span className="text-xs font-medium uppercase tracking-widest text-white/70">{t("payment.title", "Pagamento")}</span>
        </div>
      </div>

      <div className="mx-5 mt-4 rounded-2xl bg-card p-5 text-center shadow-card">
        <div className="text-sm font-semibold">{order.title}</div>
        <div className="mt-1 font-display text-3xl font-extrabold">{formatCents(order.total_cents)}</div>

        {order.status === "paid" ? (
          <div className="mt-4 flex flex-col items-center gap-2 text-green-600">
            <CheckCircle2 size={40} />
            <div className="text-sm font-semibold">{t("payment.paid", "Pagamento confirmado!")}</div>
          </div>
        ) : order.status === "failed" ? (
          <div className="mt-4 flex flex-col items-center gap-2 text-destructive">
            <XCircle size={40} />
            <div className="text-sm font-semibold">{t("payment.failed", "Pagamento não concluído.")}</div>
          </div>
        ) : (
          <div className="mt-4 flex flex-col items-center gap-2 text-[var(--sun)]">
            <Clock size={36} className="animate-pulse" />
            <div className="text-sm font-semibold">{t("payment.pending", "Aguardando pagamento…")}</div>
          </div>
        )}
      </div>

      {/* Pix */}
      {order.status === "pending" && order.payment_method === "pix" && (
        <div className="mx-5 mt-4 rounded-2xl bg-card p-5 shadow-card">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><QrCode size={16} /> {t("payment.pixTitle", "Pague com Pix")}</div>
          {order.pix_qr_image ? (
            <img src={order.pix_qr_image} alt="QR Pix" className="mx-auto h-48 w-48 rounded-xl object-contain" />
          ) : (
            <div className="mx-auto grid h-48 w-48 place-items-center rounded-xl bg-muted text-muted-foreground">
              <QrCode size={64} />
            </div>
          )}
          {order.pix_qr_code && (
            <>
              <div className="mt-3 break-all rounded-xl bg-secondary p-3 text-[11px] text-muted-foreground">
                {order.pix_qr_code}
              </div>
              <Button className="mt-3 w-full rounded-2xl" onClick={copyPix}>
                <Copy size={15} className="mr-2" /> {t("payment.copy", "Copiar código Pix")}
              </Button>
            </>
          )}
        </div>
      )}

      {/* Aviso do modo simulado (PSP ainda não configurado) */}
      {simulated && order.status === "pending" && (
        <div className="mx-5 mt-4 rounded-2xl border border-[var(--sun)]/40 bg-[var(--sun)]/10 p-4 text-xs text-[var(--earth)]">
          {t("payment.simulated", "O meio de pagamento ainda está em configuração. Este é um ambiente de teste — o pagamento real será ativado quando o gateway for conectado.")}
        </div>
      )}

      <div className="mx-5 mt-4">
        <Button variant="outline" className="w-full rounded-2xl" onClick={() => navigate({ to: "/perfil" })}>
          {t("payment.myOrders", "Ver meus pedidos")}
        </Button>
      </div>
    </div>
  );
}
