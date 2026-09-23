import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Store, ExternalLink } from "lucide-react";
import { fetchActiveStartCampaigns, resolveAsset } from "@/lib/api";

/**
 * Banner de campanhas de parceiros (loja virtual, frente #8) na tela Iniciar.
 * Rotaciona entre as campanhas ativas a cada 6s. Toque abre o link da campanha
 * (se houver) ou o perfil do parceiro. Silencioso quando não há campanha.
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

  // Rotaciona entre campanhas.
  useEffect(() => {
    if (campaigns.length <= 1) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % campaigns.length), 6000);
    return () => clearInterval(id);
  }, [campaigns.length]);

  if (campaigns.length === 0) return null;
  const c = campaigns[idx % campaigns.length];

  const open = () => {
    if (c.cta_url) {
      window.open(c.cta_url, "_blank");
    } else if (c.partner_id) {
      navigate({ to: "/u/$userId", params: { userId: c.partner_id } });
    }
  };

  return (
    <div className="mx-5 mt-4">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        <Store size={12} /> {t("startCampaign.label", "Oferta de parceiro")}
      </div>
      <button
        onClick={open}
        className="relative block w-full overflow-hidden rounded-2xl shadow-card transition-base active:scale-[0.99]"
      >
        {c.image_url ? (
          <img src={resolveAsset(c.image_url)} alt={c.title} className="h-36 w-full object-cover" />
        ) : (
          <div className="h-36 w-full bg-gradient-forest" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-3 text-left text-white">
          <div className="line-clamp-1 font-display text-base font-semibold">{c.title}</div>
          {c.description && <div className="mt-0.5 line-clamp-2 text-xs text-white/85">{c.description}</div>}
          <div className="mt-2 flex items-center gap-2">
            {c.price && (
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold backdrop-blur">{c.price}</span>
            )}
            {(c.cta_url || c.partner_id) && (
              <span className="flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold">
                {c.cta_label || t("startCampaign.defaultCta", "Ver oferta")}
                <ExternalLink size={11} />
              </span>
            )}
          </div>
        </div>
        {/* Indicadores (quando há mais de uma) */}
        {campaigns.length > 1 && (
          <div className="absolute right-2 top-2 flex gap-1">
            {campaigns.map((_, i) => (
              <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === idx % campaigns.length ? "bg-white" : "bg-white/40"}`} />
            ))}
          </div>
        )}
      </button>
    </div>
  );
}
