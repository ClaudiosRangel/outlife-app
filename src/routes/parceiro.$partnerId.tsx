import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ShieldCheck,
  MapPin,
  Star,
  Calendar,
  Clock,
  TrendingUp,
  Navigation,
  Heart,
  Share2,
} from "lucide-react";
import { StatusBar } from "@/components/StatusBar";
import { Stars } from "@/components/Stars";
import { fetchPartnerById, fetchServicesByPartner, fetchReviewsByPartner, submitReview, trackPartnerProfileView, trackPartnerContactClick } from "@/lib/api";
import { mapRateLimitErrorToMessage } from "@/lib/rate-limit-error";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const PartnerLocationMap = lazy(() => import("@/components/PartnerLocationMap"));

export const Route = createFileRoute("/parceiro/$partnerId")({
  component: PartnerDetail,
  head: ({ params }) => ({
    meta: [
      { title: "Parceiro verificado — Outlife" },
      { name: "description", content: "Conheça este parceiro outdoor verificado pelo selo Cadastur no Outlife." },
      { property: "og:title", content: "Parceiro verificado — Outlife" },
      { property: "og:type", content: "profile" },
      { property: "og:url", content: `/parceiro/${params.partnerId}` },
    ],
    links: [{ rel: "canonical", href: `/parceiro/${params.partnerId}` }],
  }),
});

function PartnerDetail() {
  const { partnerId } = Route.useParams();
  const { t } = useTranslation();

  const { data: partner, isLoading } = useQuery({
    queryKey: ["partner", partnerId],
    queryFn: () => fetchPartnerById(partnerId),
  });
  const { data: services = [] } = useQuery({
    queryKey: ["services", partnerId],
    queryFn: () => fetchServicesByPartner(partnerId),
    enabled: !!partnerId,
  });
  const { data: reviewList = [], refetch: refetchReviews } = useQuery({
    queryKey: ["reviews", "partner", partnerId],
    queryFn: () => fetchReviewsByPartner(partnerId),
    enabled: !!partnerId,
  });

  // Registra UMA visualização por sessão de página
  const viewTrackedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!partnerId || viewTrackedRef.current === partnerId) return;
    viewTrackedRef.current = partnerId;
    trackPartnerProfileView(partnerId).catch((err: unknown) => {
      const rateLimitMessage = mapRateLimitErrorToMessage(err);
      if (rateLimitMessage) {
        toast.error(rateLimitMessage);
      } else {
        console.error(err);
      }
    });
  }, [partnerId]);

  const handleContactClick = () => {
    if (!partnerId) return;
    trackPartnerContactClick(partnerId).catch((err: unknown) => {
      const rateLimitMessage = mapRateLimitErrorToMessage(err);
      if (rateLimitMessage) {
        toast.error(rateLimitMessage);
      } else {
        console.error(err);
      }
    });
  };

  if (isLoading) {
    return (
      <div className="animate-float-up pb-24">
        <StatusBar />
        <div className="px-5 pt-2">
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
        <div className="px-5 mt-4 space-y-3">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <div className="grid grid-cols-3 gap-2 pt-2">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </div>
    );
  }


  if (!partner) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-muted">
          <MapPin size={24} className="text-muted-foreground" />
        </div>
        <h2 className="mt-4 font-display text-xl font-semibold">{t("partner.notFound")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("partner.notFoundDescription")}
        </p>
        <Link
          to="/marketplace"
          className="mt-6 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          {t("partner.backToMarketplace")}
        </Link>
      </div>
    );
  }

  const galleryImages = [partner.img, ...partner.gallery].filter(Boolean);

  return (
    <div className="animate-float-up pb-24">
      <StatusBar />

      <div className="relative h-72">
        <div className="flex h-full snap-x snap-mandatory overflow-x-auto scrollbar-hide">
          {galleryImages.map((img, i) => (
            <div key={i} className="h-full w-full shrink-0 snap-center">
              <img
                src={img}
                alt={`${partner.name} ${i + 1}`}
                loading={i === 0 ? "eager" : "lazy"}
                className="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>

        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-hero" />

        <div className="absolute left-4 right-4 top-4 flex items-center justify-between">
          <Link to="/marketplace" className="grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur-md transition-base hover:bg-black/60">
            <ChevronLeft size={18} />
          </Link>
          <div className="flex gap-2">
            <button className="grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur-md transition-base hover:bg-black/60">
              <Heart size={18} />
            </button>
            <button className="grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur-md transition-base hover:bg-black/60">
              <Share2 size={18} />
            </button>
          </div>
        </div>

        <div className="absolute left-4 top-16 flex gap-2">
          {partner.verified && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--verified)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
              <ShieldCheck size={11} strokeWidth={3} /> {t("partner.verifiedCadastur")}
            </div>
          )}
          <div className="rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-md">
            {partner.category}
          </div>
        </div>

        <div className="absolute bottom-4 left-5 right-5">
          <h1 className="font-display text-2xl font-semibold text-white drop-shadow-sm">{partner.name}</h1>
          <div className="mt-1 flex items-center gap-1 text-[12px] text-white/80">
            <MapPin size={12} /> {partner.location}
          </div>
        </div>
      </div>

      <div className="px-5 pt-5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="font-display text-2xl font-semibold">{partner.rating}</div>
            <Stars value={partner.rating} />
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{partner.reviews}</span> {t("partner.reviews")}
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{partner.category}</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {partner.available ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--verified)]/10 px-2.5 py-1 text-[11px] font-medium text-[var(--verified)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--verified)]" /> {t("common.available")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              <Clock size={11} /> {t("common.unavailable")}
            </span>
          )}
          {partner.verified && (
            <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-secondary-foreground">
              {t("partner.cadasturActive")}
            </span>
          )}
          {partner.rating >= 4.8 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--sun)]/15 px-2.5 py-1 text-[11px] font-medium text-[var(--earth)]">
              <TrendingUp size={11} /> {t("partner.topRated")}
            </span>
          )}
        </div>

        <p className="mt-4 text-sm leading-relaxed text-foreground/80">{partner.description}</p>

        {partner.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {partner.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[11px] font-medium">{tag}</Badge>
            ))}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between rounded-2xl bg-muted p-4">
          <div>
            <div className="text-[11px] text-muted-foreground">{t("partner.startingAt")}</div>
            <div className="font-display text-xl font-semibold text-primary">{partner.price}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-muted-foreground">{t("partner.category")}</div>
            <div className="text-sm font-medium">{partner.subcategory}</div>
          </div>
        </div>

        {services.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold">{t("partner.servicesOffered")}</h3>
            <div className="mt-2 space-y-2">
              {services.map((s: any) => (
                <div key={s.id} className="rounded-2xl border border-border bg-card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">{s.title}</div>
                      {s.destination?.name && (
                        <div className="text-[11px] text-muted-foreground">📍 {s.destination.name}</div>
                      )}
                      {s.description && (
                        <p className="mt-1 text-xs text-foreground/70 line-clamp-2">{s.description}</p>
                      )}
                    </div>
                    {s.price != null && (
                      <div className="text-sm font-semibold text-primary whitespace-nowrap">
                        R$ {Number(s.price).toFixed(0)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6">
          <h3 className="text-sm font-semibold">{t("partner.location")}</h3>
          {partner.coords ? (
            <>
              <div className="mt-2 overflow-hidden rounded-2xl border border-border">
                <Suspense fallback={<div className="h-[220px] bg-muted animate-pulse" />}>
                  <PartnerLocationMap
                    lat={partner.coords.lat}
                    lng={partner.coords.lng}
                    name={partner.name}
                    location={partner.location}
                  />
                </Suspense>
              </div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${partner.coords.lat},${partner.coords.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-xs font-semibold text-foreground transition-base hover:bg-muted"
              >
                <Navigation size={14} /> {t("partner.openInGoogleMaps")}
              </a>
            </>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">{t("partner.noLocation")}</p>
          )}
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-semibold">{t("partner.contact")}</h3>
          <p className="mt-2 text-xs text-muted-foreground">{t("partner.contactNote")}</p>
          <button
            onClick={handleContactClick}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-base hover:bg-primary/90"
          >
            <Calendar size={14} /> {t("partner.book")}
          </button>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{t("partner.reviewsTitle")}</h3>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Star size={12} className="fill-[var(--sun)] text-[var(--sun)]" />
              <span className="font-semibold text-foreground">{partner.rating}</span>
              <span>· {partner.reviews}</span>
            </div>
          </div>

          <div className="mt-3 space-y-3">
            {reviewList.length === 0 && (
              <p className="text-xs text-muted-foreground">{t("partner.noReviewsYet")}</p>
            )}
            {reviewList.map((r) => {
              const name = r.author?.full_name ?? "Aventureiro";
              const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
              const date = new Date(r.created_at).toLocaleDateString("pt-BR");
              return (
                <div key={r.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">{name}</div>
                      <div className="text-[11px] text-muted-foreground">{date}</div>
                    </div>
                    <div className="flex items-center gap-1 rounded-full bg-[var(--sun)]/10 px-2 py-0.5">
                      <Star size={10} className="fill-[var(--sun)] text-[var(--sun)]" />
                      <span className="text-[11px] font-medium">{r.rating}</span>
                    </div>
                  </div>
                  {r.comment && <p className="mt-2 text-sm leading-relaxed text-foreground/80">{r.comment}</p>}
                </div>
              );
            })}
          </div>

          <LeaveReview partnerId={partner.id} onSubmitted={() => refetchReviews()} />
        </div>
      </div>
    </div>
  );
}

function LeaveReview({ partnerId, onSubmitted }: { partnerId: string; onSubmitted?: () => void }) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating < 1) {
      toast.error("Selecione uma nota.");
      return;
    }
    setSubmitting(true);
    try {
      const { xp } = await submitReview(partnerId, "partner", rating, comment);
      setComment("");
      toast.success(`${t("review.submitted")} +${xp} XP`);
      onSubmitted?.();
    } catch (e: any) {
      toast.error(e.message ?? t("review.error"));
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <div className="mt-4 rounded-2xl border border-dashed border-border bg-card p-4">
      <h4 className="text-sm font-semibold">{t("review.leaveReview")}</h4>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{t("review.rating")}:</span>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            className="transition-base"
            aria-label={`${n} estrelas`}
          >
            <Star
              size={18}
              className={n <= rating ? "fill-[var(--sun)] text-[var(--sun)]" : "text-muted-foreground"}
            />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={t("review.comment")}
        rows={3}
        className="mt-3 w-full rounded-xl border border-border bg-background p-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
      />
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="mt-3 w-full rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
      >
        {submitting ? t("common.loading") : t("review.submit")}
      </button>
    </div>
  );
}
