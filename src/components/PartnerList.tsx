import { Link } from "@tanstack/react-router";
import { MapPin, ShieldCheck, Star } from "lucide-react";
import type { Partner } from "@/lib/api";

/**
 * PartnerList — grid compacto e reutilizável de parceiros (spec
 * parceiros-cadastros-completos, item 8). Extraído do padrão de card do
 * marketplace para ser usado na aba "Parceiros" da tela Explorar sem duplicar
 * a lógica de filtro avançado (que permanece no marketplace).
 *
 * Cada card leva ao detalhe do parceiro (/parceiro/:id).
 */
export interface PartnerListProps {
  partners: Partner[];
  /** Rótulo i18n do preço "a partir de" (opcional). */
  reviewsLabel?: string;
}

export function PartnerList({ partners }: PartnerListProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {partners.map((partner) => (
        <Link
          key={partner.id}
          to="/parceiro/$partnerId"
          params={{ partnerId: partner.id }}
          className="group overflow-hidden rounded-2xl bg-card text-left shadow-card transition-base hover:shadow-float active:scale-[0.98]"
        >
          <div className="relative h-28">
            <img
              src={partner.img}
              alt={partner.name}
              loading="lazy"
              className="h-full w-full object-cover transition-base group-hover:scale-105"
            />
            <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/60 to-transparent" />
            {partner.verified && (
              <div className="absolute left-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-[var(--verified)] text-white">
                <ShieldCheck size={10} strokeWidth={3} />
              </div>
            )}
            <div className="absolute bottom-2 left-2 right-2">
              <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[9px] font-medium text-white backdrop-blur-sm">
                {partner.subcategory || partner.category}
              </span>
            </div>
          </div>
          <div className="p-3">
            <h3 className="truncate text-sm font-semibold leading-tight">{partner.name}</h3>
            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
              <MapPin size={10} /> {partner.location}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Star size={11} className="fill-[var(--sun)] text-[var(--sun)]" />
                <span className="text-[11px] font-medium">{partner.rating}</span>
                <span className="text-[10px] text-muted-foreground">({partner.reviews})</span>
              </div>
              <span className="text-[11px] font-semibold text-primary">{partner.price}</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
