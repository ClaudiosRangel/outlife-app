import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ChevronLeft, Tag, QrCode, CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { StatusBar } from "@/components/StatusBar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchCampaignById,
  validateCoupon,
  createOrder,
  createPayment,
  formatCents,
  resolveAsset,
} from "@/lib/api";

export const Route = createFileRoute("/checkout/$campaignId")({
  component: CheckoutPage,
  head: () => ({
    meta: [
      { title: "Pagamento — OutVitar" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/checkout" }],
  }),
});

// Preço em centavos a partir do texto (mesma lógica do backend, para exibir).
function priceCents(price: string | null | undefined): number {
  if (!price) return 0;
  let c = price.replace(/[^0-9,.]/g, "");
  if (!c) return 0;
  if (c.includes(",")) c = c.replace(/\./g, "").replace(",", ".");
  const v = Number(c);
  return Number.isFinite(v) ? Math.round(v * 100) : 0;
}

function CheckoutPage() {
  const { campaignId } = Route.useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [couponCode, setCouponCode] = useState("");
  const [discountCents, setDiscountCents] = useState(0);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [method, setMethod] = useState<"pix" | "card">("pix");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const { data: campaign, isLoading } = useQuery({
    queryKey: ["campaign", campaignId],
    queryFn: () => fetchCampaignById(campaignId),
  });

  const amountCents = useMemo(() => priceCents(campaign?.price), [campaign?.price]);
  const totalCents = Math.max(amountCents - discountCents, 0);

  const applyCoupon = useMutation({
    mutationFn: () => validateCoupon(couponCode.trim(), amountCents, campaign?.partner_id ?? null),
    onSuccess: (r) => {
      setDiscountCents(r.valid ? r.discountCents : 0);
      setCouponMsg(r.message);
      if (r.valid) toast.success(r.message);
      else toast.error(r.message);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pay = useMutation({
    mutationFn: async () => {
      const order = await createOrder(campaignId, couponCode.trim() || null, method);
      // Aciona a criação da cobrança no PSP (modo simulado até configurar).
      await createPayment(order.id).catch(() => {/* segue para a tela de pagamento mesmo assim */});
      return order;
    },
    onSuccess: (order) => {
      navigate({ to: "/pagamento/$orderId", params: { orderId: order.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="animate-float-up pb-24">
        <StatusBar />
        <div className="mx-5 mt-4 space-y-3"><Skeleton className="h-40 w-full rounded-2xl" /></div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <h1 className="text-lg font-semibold">{t("checkout.notFound", "Oferta não encontrada.")}</h1>
        <button onClick={() => window.history.back()} className="mt-4 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">
          {t("common.back", "Voltar")}
        </button>
      </div>
    );
  }

  const hasPrice = amountCents > 0;

  return (
    <div className="flex min-h-screen flex-col pb-6">
      <div className="bg-gradient-forest px-5 pb-4 text-white">
        <StatusBar light />
        <div className="flex items-center gap-3 pt-2">
          <button onClick={() => window.history.back()} className="grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur-md">
            <ChevronLeft size={18} />
          </button>
          <span className="text-xs font-medium uppercase tracking-widest text-white/70">{t("checkout.title", "Pagamento")}</span>
        </div>
      </div>

      {/* Resumo da oferta */}
      <div className="mx-5 mt-4 flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card">
        {campaign.image_url && <img src={resolveAsset(campaign.image_url)} alt="" className="h-16 w-16 rounded-xl object-cover" />}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{campaign.title}</div>
          {campaign.description && <div className="line-clamp-2 text-[11px] text-muted-foreground">{campaign.description}</div>}
        </div>
      </div>

      {!hasPrice ? (
        <div className="mx-5 mt-4 rounded-2xl bg-card p-5 text-center text-sm text-muted-foreground shadow-card">
          {t("checkout.noPrice", "Esta oferta não tem preço definido. Entre em contato com o parceiro pela oferta.")}
        </div>
      ) : (
        <>
          {/* Cupom */}
          <div className="mx-5 mt-4">
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">{t("checkout.coupon", "Cupom de desconto")}</div>
            <div className="flex gap-2">
              <Input
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder={t("checkout.couponPlaceholder", "Digite o código")}
                className="flex-1"
              />
              <Button variant="outline" onClick={() => applyCoupon.mutate()} disabled={!couponCode.trim() || applyCoupon.isPending}>
                {applyCoupon.isPending ? <Loader2 size={15} className="animate-spin" /> : <Tag size={15} />}
              </Button>
            </div>
            {couponMsg && <div className={`mt-1 text-[11px] ${discountCents > 0 ? "text-primary" : "text-muted-foreground"}`}>{couponMsg}</div>}
          </div>

          {/* Método de pagamento */}
          <div className="mx-5 mt-4">
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">{t("checkout.method", "Forma de pagamento")}</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMethod("pix")}
                className={`flex items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-medium transition-base ${method === "pix" ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary"}`}
              >
                <QrCode size={16} /> Pix
              </button>
              <button
                onClick={() => setMethod("card")}
                className={`flex items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-medium transition-base ${method === "card" ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary"}`}
              >
                <CreditCard size={16} /> {t("checkout.card", "Cartão")}
              </button>
            </div>
          </div>

          {/* Totais */}
          <div className="mx-5 mt-4 space-y-1.5 rounded-2xl bg-card p-4 shadow-card">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("checkout.subtotal", "Subtotal")}</span>
              <span>{formatCents(amountCents)}</span>
            </div>
            {discountCents > 0 && (
              <div className="flex justify-between text-sm text-primary">
                <span>{t("checkout.discount", "Desconto")}</span>
                <span>- {formatCents(discountCents)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-1.5 text-base font-bold">
              <span>{t("checkout.total", "Total")}</span>
              <span>{formatCents(totalCents)}</span>
            </div>
          </div>

          <div className="mx-5 mt-4">
            <Button className="h-12 w-full rounded-2xl text-sm font-semibold" disabled={pay.isPending} onClick={() => pay.mutate()}>
              {pay.isPending ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
              {t("checkout.pay", "Pagar")} {formatCents(totalCents)}
            </Button>
            <div className="mt-2 flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
              <ShieldCheck size={12} /> {t("checkout.secure", "Pagamento processado com segurança")}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
