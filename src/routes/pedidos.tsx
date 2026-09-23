import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ShoppingBag, CheckCircle2, Clock, XCircle } from "lucide-react";
import { StatusBar } from "@/components/StatusBar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { fetchMyOrders, formatCents, type Order } from "@/lib/api";

export const Route = createFileRoute("/pedidos")({
  component: OrdersPage,
  head: () => ({
    meta: [
      { title: "Meus pedidos — OutVitar" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/pedidos" }],
  }),
});

function statusInfo(status: Order["status"], t: (k: string, d?: string) => string) {
  switch (status) {
    case "paid": return { Icon: CheckCircle2, color: "text-green-600", label: t("orders.paid", "Pago") };
    case "failed": return { Icon: XCircle, color: "text-destructive", label: t("orders.failed", "Falhou") };
    case "canceled": return { Icon: XCircle, color: "text-muted-foreground", label: t("orders.canceled", "Cancelado") };
    case "refunded": return { Icon: XCircle, color: "text-muted-foreground", label: t("orders.refunded", "Reembolsado") };
    default: return { Icon: Clock, color: "text-[var(--sun)]", label: t("orders.pending", "Aguardando") };
  }
}

function OrdersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["my-orders", user?.id],
    queryFn: fetchMyOrders,
    enabled: !!user,
  });

  return (
    <div className="animate-float-up pb-12">
      <div className="bg-gradient-forest px-5 pb-4 text-white">
        <StatusBar light />
        <div className="flex items-center gap-3 pt-2">
          <Link to="/perfil" className="grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur-md">
            <ChevronLeft size={18} />
          </Link>
          <span className="text-xs font-medium uppercase tracking-widest text-white/70">{t("orders.title", "Meus pedidos")}</span>
        </div>
      </div>

      <div className="mx-5 mt-4 space-y-2">
        {isLoading ? (
          [0, 1].map((i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)
        ) : orders.length === 0 ? (
          <div className="rounded-2xl bg-card p-6 text-center text-xs text-muted-foreground shadow-card">
            {t("orders.empty", "Você ainda não fez nenhum pedido.")}
          </div>
        ) : (
          orders.map((o) => {
            const si = statusInfo(o.status, t);
            return (
              <Link
                key={o.id}
                to="/pagamento/$orderId"
                params={{ orderId: o.id }}
                className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card transition-base active:scale-[0.99]"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <ShoppingBag size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{o.title}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(o.created_at).toLocaleDateString("pt-BR")} · {formatCents(o.total_cents)}
                  </div>
                </div>
                <span className={`flex items-center gap-1 text-[11px] font-semibold ${si.color}`}>
                  <si.Icon size={13} /> {si.label}
                </span>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
