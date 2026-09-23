import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ExternalLink, Store, Tag, Briefcase } from "lucide-react";
import { StatusBar } from "@/components/StatusBar";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchCampaignById, fetchPartnerById, resolveAsset } from "@/lib/api";
import { getTheme } from "@/lib/campaign-style";

export const Route = createFileRoute("/oferta/$campaignId")({
  component: OfferPage,
  head: () => ({
    meta: [
      { title: "Oferta — OutVitar" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/oferta" }],
  }),
});

function OfferPage() {
  const { campaignId } = Route.useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: campaign, isLoading } = useQuery({
    queryKey: ["campaign", campaignId],
    queryFn: () => fetchCampaignById(campaignId),
  });

  const { data: partner } = useQuery({
    queryKey: ["partner", campaign?.partner_id],
    queryFn: () => fetchPartnerById(campaign!.partner_id as string),
    enabled: !!campaign?.partner_id,
  });

  if (isLoading) {
    return (
      <div className="animate-float-up pb-24">
        <StatusBar />
        <div className="mx-5 mt-4 space-y-3">
          <Skeleton className="h-56 w-full rounded-3xl" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <Store size={40} className="mb-3 opacity-40" />
        <h1 className="text-lg font-semibold">{t("offer.notFound", "Oferta não encontrada ou encerrada.")}</h1>
        <button onClick={() => window.history.back()} className="mt-4 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">
          {t("common.back", "Voltar")}
        </button>
      </div>
    );
  }

  const th = getTheme(campaign.theme);
  const img = campaign.image_url ? resolveAsset(campaign.image_url) : null;

  return (
    <div className="animate-float-up pb-24">
      {/* Hero com a imagem (ou cor do tema) */}
      <div className="relative">
        <div className="absolute left-4 top-4 z-10">
          <button onClick={() => window.history.back()} className="grid h-9 w-9 place-items-center rounded-full bg-black/40 text-white backdrop-blur">
            <ChevronLeft size={18} />
          </button>
        </div>
        <span className="absolute right-4 top-4 z-10 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur">
          {t("startCampaign.sponsored", "Patrocinado")}
        </span>
        {img ? (
          <img src={img} alt={campaign.title} className="h-64 w-full object-cover" />
        ) : (
          <div className="h-64 w-full" style={{ background: th.gradient }} />
        )}
      </div>

      <div className="mx-5 -mt-6 rounded-3xl bg-card p-5 shadow-card">
        <h1 className="font-display text-2xl font-extrabold leading-tight">{campaign.title}</h1>
        {campaign.price && (
          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
            <Tag size={14} /> {campaign.price}
          </div>
        )}
        {campaign.description && (
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{campaign.description}</p>
        )}

        {/* Parceiro */}
        {partner && (
          <Link
            to="/u/$userId"
            params={{ userId: campaign.partner_id as string }}
            className="mt-4 flex items-center gap-3 rounded-2xl bg-secondary/50 p-3 transition-base active:scale-[0.99]"
          >
            <img src={resolveAsset(partner.img)} alt={partner.name} className="h-11 w-11 rounded-full object-cover" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{partner.name}</div>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Briefcase size={11} /> {partner.category || t("offer.partner", "Parceiro")}
              </div>
            </div>
          </Link>
        )}
      </div>

      {/* CTA fixo */}
      <div className="mx-5 mt-4 space-y-2">
        {campaign.cta_url && (
          <button
            onClick={() => window.open(campaign.cta_url as string, "_blank")}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground active:scale-[0.99]"
          >
            {campaign.cta_label || t("startCampaign.defaultCta", "Ver oferta")}
            <ExternalLink size={16} />
          </button>
        )}
        {campaign.partner_id && (
          <button
            onClick={() => navigate({ to: "/u/$userId", params: { userId: campaign.partner_id as string } })}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3 text-sm font-semibold active:scale-[0.99]"
          >
            <Briefcase size={16} /> {t("offer.viewPartner", "Ver o parceiro")}
          </button>
        )}
      </div>
    </div>
  );
}
