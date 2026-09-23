import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CampaignCard } from "@/components/StartCampaignBanner";
import type { PartnerCampaign } from "@/lib/api";

/**
 * Carrossel de ofertas (loja virtual) com AUTOPLAY e scroll suave. Reutilizado
 * na Comunidade e na Home. Avança sozinho a cada `intervalMs`; pausa quando o
 * usuário toca/arrasta e retoma depois. Um card por vez (scroll-snap).
 */
export default function CampaignCarousel({
  campaigns,
  intervalMs = 4000,
  cardWidthClass = "w-[85%]",
}: {
  campaigns: PartnerCampaign[];
  intervalMs?: number;
  cardWidthClass?: string;
}) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const pausedRef = useRef(false);
  const indexRef = useRef(0);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  // Autoplay: avança para o próximo card com scroll suave.
  useEffect(() => {
    if (campaigns.length <= 1) return;
    const id = setInterval(() => {
      if (pausedRef.current) return;
      const el = scrollRef.current;
      if (!el) return;
      const next = (indexRef.current + 1) % campaigns.length;
      const child = el.children[next] as HTMLElement | undefined;
      if (child) {
        el.scrollTo({ left: child.offsetLeft - el.offsetLeft, behavior: "smooth" });
        setIndex(next);
      }
    }, intervalMs);
    return () => clearInterval(id);
  }, [campaigns.length, intervalMs]);

  // Sincroniza o índice quando o usuário arrasta manualmente + pausa/retoma.
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    // Card mais próximo do início visível.
    let closest = 0;
    let min = Infinity;
    for (let i = 0; i < el.children.length; i++) {
      const c = el.children[i] as HTMLElement;
      const d = Math.abs(c.offsetLeft - el.offsetLeft - el.scrollLeft);
      if (d < min) { min = d; closest = i; }
    }
    setIndex(closest);
  };

  const pause = () => { pausedRef.current = true; };
  const resume = () => {
    // Pequeno atraso antes de retomar o autoplay após interação.
    setTimeout(() => { pausedRef.current = false; }, 2500);
  };

  if (campaigns.length === 0) return null;

  return (
    <div>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        onPointerDown={pause}
        onPointerUp={resume}
        onTouchStart={pause}
        onTouchEnd={resume}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scrollbar-hide pb-1"
      >
        {campaigns.map((c) => (
          <div key={c.id} className={`${cardWidthClass} shrink-0 snap-center`}>
            <CampaignCard
              c={c}
              onClick={() => navigate({ to: "/oferta/$campaignId", params: { campaignId: c.id } })}
            />
          </div>
        ))}
      </div>
      {/* Indicadores */}
      {campaigns.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {campaigns.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-primary" : "w-1.5 bg-muted"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
