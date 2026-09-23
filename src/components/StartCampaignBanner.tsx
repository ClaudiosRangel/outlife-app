import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Store, ArrowRight } from "lucide-react";
import { fetchActiveStartCampaigns, resolveAsset, type PartnerCampaign } from "@/lib/api";
import { getTheme, normalizeLayout } from "@/lib/campaign-style";

/**
 * Banner de campanhas de parceiros (loja virtual) na tela Iniciar. Chamativo,
 * com tema (paleta) e layout escolhidos na criação. Rotaciona a cada 6s.
 * Silencioso quando não há campanha.
 */
export default function StartCampaignBanner() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [idx, setIdx] = useState(0);

  const { data: campaigns = [] } = useQuery({
    queryKey: ["start-campaigns"],
    queryFn: fetchActiveStartCampaigns,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  useEffect(() => {
    if (campaigns.length <= 1) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % campaigns.length), 6000);
    return () => clearInterval(id);
  }, [campaigns.length]);

  if (campaigns.length === 0) return null;
  const c = campaigns[idx % campaigns.length];

  const open = () => {
    if (c.cta_url) window.open(c.cta_url, "_blank");
    else if (c.partner_id) navigate({ to: "/u/$userId", params: { userId: c.partner_id } });
  };

  return (
    <div className="mx-5 mt-4">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        <Store size={12} /> {t("startCampaign.label", "Oferta de parceiro")}
      </div>
      <CampaignCard c={c} onClick={open} />
      {campaigns.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {campaigns.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`h-1.5 rounded-full transition-all ${i === idx % campaigns.length ? "w-5 bg-primary" : "w-1.5 bg-muted"}`}
              aria-label={`slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Card visual da campanha, aplicando tema + layout. Reutilizável no preview
 * do admin (passar `preview`) e no banner do Iniciar.
 */
export function CampaignCard({
  c,
  onClick,
  preview = false,
}: {
  c: Pick<PartnerCampaign, "title" | "description" | "image_url" | "cta_label" | "cta_url" | "price" | "partner_id" | "theme" | "layout">;
  onClick?: () => void;
  preview?: boolean;
}) {
  const { t } = useTranslation();
  const th = getTheme(c.theme);
  const layout = normalizeLayout(c.layout);
  const hasCta = preview || !!c.cta_url || !!c.partner_id;
  const img = c.image_url ? resolveAsset(c.image_url) : null;

  const ctaChip = (
    <span
      className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-bold shadow-sm"
      style={{ backgroundColor: th.ctaBg, color: th.ctaText }}
    >
      {c.cta_label || t("startCampaign.defaultCta", "Ver oferta")}
      <ArrowRight size={13} />
    </span>
  );
  const priceChip = c.price ? (
    <span className="rounded-full px-2.5 py-1 text-[12px] font-extrabold" style={{ backgroundColor: th.chipBg, color: th.chipText }}>
      {c.price}
    </span>
  ) : null;

  const badge = (
    <span className="absolute left-3 top-3 z-10 rounded-full bg-black/45 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white backdrop-blur">
      {t("startCampaign.sponsored", "Patrocinado")}
    </span>
  );

  const Wrapper = onClick ? "button" : "div";

  // Layout SOLID: cor/gradiente do tema, sem imagem de fundo.
  if (layout === "solid" || !img) {
    return (
      <Wrapper
        onClick={onClick}
        className="relative block w-full overflow-hidden rounded-3xl text-left shadow-card transition-base active:scale-[0.99]"
        style={{ background: th.gradient, color: th.text }}
      >
        {badge}
        <div className="flex items-center gap-3 p-5 pt-8">
          {img && <img src={img} alt="" className="h-20 w-20 shrink-0 rounded-2xl object-cover shadow-lg" />}
          <div className="min-w-0 flex-1">
            <div className="font-display text-xl font-extrabold leading-tight">{c.title}</div>
            {c.description && <div className="mt-1 line-clamp-2 text-sm opacity-90">{c.description}</div>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {priceChip}
              {hasCta && ctaChip}
            </div>
          </div>
        </div>
      </Wrapper>
    );
  }

  // Layout SPLIT: imagem à esquerda, texto sobre cor do tema à direita.
  if (layout === "split") {
    return (
      <Wrapper
        onClick={onClick}
        className="relative block w-full overflow-hidden rounded-3xl text-left shadow-card transition-base active:scale-[0.99]"
        style={{ background: th.gradient, color: th.text }}
      >
        {badge}
        <div className="flex items-stretch">
          <img src={img} alt={c.title} className="h-40 w-2/5 shrink-0 object-cover" />
          <div className="flex min-w-0 flex-1 flex-col justify-center p-4">
            <div className="font-display text-lg font-extrabold leading-tight">{c.title}</div>
            {c.description && <div className="mt-1 line-clamp-2 text-xs opacity-90">{c.description}</div>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {priceChip}
              {hasCta && ctaChip}
            </div>
          </div>
        </div>
      </Wrapper>
    );
  }

  // Layout OVERLAY (padrão): imagem cheia + gradiente escuro + texto embaixo.
  return (
    <Wrapper
      onClick={onClick}
      className="relative block w-full overflow-hidden rounded-3xl text-left shadow-card transition-base active:scale-[0.99]"
    >
      {badge}
      <img src={img} alt={c.title} className="h-48 w-full object-cover" />
      <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.15) 55%, transparent 100%)" }} />
      <div className="absolute inset-x-0 bottom-0 p-4 text-white">
        <div className="font-display text-xl font-extrabold leading-tight drop-shadow">{c.title}</div>
        {c.description && <div className="mt-1 line-clamp-2 text-sm text-white/90">{c.description}</div>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {priceChip}
          {hasCta && ctaChip}
        </div>
      </div>
    </Wrapper>
  );
}
