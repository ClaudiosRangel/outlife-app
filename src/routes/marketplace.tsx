import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ChevronLeft,
  ShieldCheck,
  MapPin,
  Star,
  Search,
  SlidersHorizontal,
  X,
  Check,
  Clock,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { StatusBar } from "@/components/StatusBar";
import { Stars } from "@/components/Stars";
import { fetchPartners } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/marketplace")({
  component: Marketplace,
  head: () => ({
    meta: [
      { title: "Marketplace Outdoor — Outlife" },
      { name: "description", content: "Encontre empresas e profissionais outdoor verificados pelo selo Cadastur: guias, pousadas, aluguel de equipamentos e mais." },
      { property: "og:title", content: "Marketplace Outdoor — Outlife" },
      { property: "og:description", content: "Empresas e profissionais outdoor verificados pelo selo Cadastur." },
      { property: "og:url", content: "/marketplace" },
    ],
    links: [{ rel: "canonical", href: "/marketplace" }],
  }),
});

// Internal category keys (must match data) paired with i18n keys
const categoryDefs = [
  { value: "Todos", k: "all" },
  { value: "Guias", k: "guides" },
  { value: "Pousadas", k: "lodges" },
  { value: "Aluguel", k: "rental" },
  { value: "Fotógrafos", k: "photographers" },
  { value: "Restaurantes", k: "restaurants" },
  { value: "Agências", k: "agencies" },
] as const;

function Marketplace() {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<"relevance" | "rating" | "reviews">("relevance");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState(2000);

  const { data: partners = [], isLoading } = useQuery({
    queryKey: ["partners"],
    queryFn: fetchPartners,
  });

  const filteredPartners = useMemo(() => {
    let result = [...partners];

    if (activeCategory !== "Todos") {
      result = result.filter((p) => p.category === activeCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.location.toLowerCase().includes(q) ||
          p.subcategory.toLowerCase().includes(q) ||
          p.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }

    if (verifiedOnly) result = result.filter((p) => p.verified);
    if (availableOnly) result = result.filter((p) => p.available);

    result = result.filter((p) => {
      const num = parseInt(p.price.replace(/[^0-9]/g, ""), 10) || 0;
      return num <= maxPrice;
    });

    if (sortBy === "rating") result.sort((a, b) => b.rating - a.rating);
    else if (sortBy === "reviews") result.sort((a, b) => b.reviews - a.reviews);

    return result;
  }, [partners, activeCategory, searchQuery, sortBy, verifiedOnly, availableOnly, maxPrice]);

  const featured = partners.find((p) => p.verified && p.rating >= 4.9) || partners[0];
  const featuredInList = featured ? filteredPartners.find((p) => p.id === featured.id) : undefined;
  const listPartners = featured ? filteredPartners.filter((p) => p.id !== featured.id) : filteredPartners;

  const localizedCategoryLabel = (value: string) => {
    const def = categoryDefs.find((c) => c.value === value);
    return def ? t(`marketplace.categories.${def.k}`) : value;
  };

  return (
    <div className="animate-float-up pb-24">
      <StatusBar />

      <div className="px-5 pt-2">
        <div className="flex items-center justify-between">
          <Link to="/" className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card">
            <ChevronLeft size={18} />
          </Link>
          <span className="text-xs font-medium text-muted-foreground">{t("marketplace.header")}</span>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`grid h-10 w-10 place-items-center rounded-full border transition-base ${showFilters ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}
          >
            <SlidersHorizontal size={16} />
          </button>
        </div>

        <h1 className="mt-4 font-display text-3xl font-semibold leading-tight">{t("marketplace.headline")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("marketplace.subtitle")}</p>

        <Link
          to="/compliance"
          className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary"
        >
          {t("marketplace.verifyCta")}
        </Link>

        <div className="relative mt-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={t("marketplace.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-11 w-full rounded-2xl border border-border bg-card pl-10 pr-4 text-sm outline-none ring-ring focus:ring-1 transition-base placeholder:text-muted-foreground"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X size={14} className="text-muted-foreground" />
            </button>
          )}
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5 pb-1">
          {categoryDefs.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-medium transition-base ${
                activeCategory === cat.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {t(`marketplace.categories.${cat.k}`)}
            </button>
          ))}
        </div>
      </div>

      {showFilters && (
        <div className="mx-5 mt-4 rounded-2xl border border-border bg-card p-4 animate-float-up">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("marketplace.filtersTitle")}
            </span>
            <button
              onClick={() => {
                setSortBy("relevance");
                setVerifiedOnly(false);
                setAvailableOnly(false);
              }}
              className="text-xs text-primary"
            >
              {t("common.clear")}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { key: "relevance", label: t("marketplace.sortRelevance") },
              { key: "rating", label: t("marketplace.sortRating") },
              { key: "reviews", label: t("marketplace.sortReviews") },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSortBy(opt.key as typeof sortBy)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition-base ${
                  sortBy === opt.key
                    ? "bg-accent text-accent-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex gap-3">
            <button
              onClick={() => setVerifiedOnly(!verifiedOnly)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-base ${
                verifiedOnly ? "bg-[var(--verified)]/15 text-[var(--verified)]" : "bg-muted text-muted-foreground"
              }`}
            >
              {verifiedOnly ? <Check size={12} /> : <ShieldCheck size={12} />}
              {t("marketplace.verifiedFilter")}
            </button>
            <button
              onClick={() => setAvailableOnly(!availableOnly)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-base ${
                availableOnly ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
              }`}
            >
              {availableOnly ? <Check size={12} /> : <Clock size={12} />}
              {t("marketplace.availableFilter")}
            </button>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("marketplace.priceRange")}
              </span>
              <span className="text-[11px] font-medium text-primary">R$ 0 - R$ {maxPrice}</span>
            </div>
            <Slider
              value={[maxPrice]}
              onValueChange={(v) => setMaxPrice(v[0])}
              min={100}
              max={2000}
              step={50}
              className="mt-3"
            />
          </div>
        </div>
      )}

      <div className="px-5 mt-4 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {isLoading
            ? t("common.loading")
            : `${filteredPartners.length} ${filteredPartners.length === 1 ? t("marketplace.result") : t("marketplace.results")}`}
        </span>
        {activeCategory !== "Todos" && (
          <Badge variant="secondary" className="text-[10px]">
            {localizedCategoryLabel(activeCategory)}
          </Badge>
        )}
      </div>

      {featured && !searchQuery && activeCategory === "Todos" && !verifiedOnly && !availableOnly && (
        <div className="mx-5 mt-4 overflow-hidden rounded-3xl bg-card shadow-card">
          <div className="relative h-52">
            <img src={featured.img} alt={featured.name} loading="lazy" className="h-full w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-hero" />
            {featured.verified && (
              <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--verified)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
                <ShieldCheck size={11} strokeWidth={3} /> {t("marketplace.verifiedFilter")}
              </div>
            )}
            <div className="absolute right-4 top-4 flex flex-col items-end gap-1">
              <span className="rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-md">
                {localizedCategoryLabel(featured.category)}
              </span>
              {featured.rating >= 4.8 && featured.verified && (
                <span className="rounded-full bg-[var(--sun)]/20 px-2 py-0.5 text-[10px] font-semibold text-[var(--earth)] backdrop-blur-md">
                  {t("marketplace.featured")}
                </span>
              )}
            </div>
            <div className="absolute bottom-4 left-4 right-4">
              <h3 className="font-display text-xl font-semibold text-white leading-tight">{featured.name}</h3>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-white/80">
                <MapPin size={11} /> {featured.location}
              </div>
            </div>
          </div>
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-sm text-foreground/80 line-clamp-2">{featured.description}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {featured.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 font-display text-lg font-semibold">
                  {featured.rating}
                  <Star size={14} className="fill-[var(--sun)] text-[var(--sun)]" />
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {featured.reviews} {t("marketplace.reviewsCount")}
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="font-display text-sm font-semibold text-primary">{featured.price}</span>
              <Link
                to="/parceiro/$partnerId"
                params={{ partnerId: featured.id }}
                className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-base hover:bg-primary/90"
              >
                {t("marketplace.viewDetails")}
              </Link>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="px-5 mt-5 grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl bg-card shadow-card">
              <Skeleton className="h-28 w-full rounded-none" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-5 mt-5 grid grid-cols-2 gap-3">
          {listPartners.map((partner) => (
            <Link
              key={partner.id}
              to="/parceiro/$partnerId"
              params={{ partnerId: partner.id }}
              className="group overflow-hidden rounded-2xl bg-card text-left shadow-card transition-base hover:shadow-float"
            >
              <div className="relative h-28">
                <img src={partner.img} alt={partner.name} loading="lazy" className="h-full w-full object-cover transition-base group-hover:scale-105" />
                <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/60 to-transparent" />
                {partner.verified && (
                  <div className="absolute left-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-[var(--verified)] text-white">
                    <ShieldCheck size={10} strokeWidth={3} />
                  </div>
                )}
                {partner.rating >= 4.8 && partner.verified && (
                  <div className="absolute left-2 bottom-8 rounded-full bg-[var(--sun)]/20 px-2 py-0.5 text-[10px] font-semibold text-[var(--earth)] backdrop-blur-sm">
                    {t("marketplace.featured")}
                  </div>
                )}
                {!partner.available && (
                  <div className="absolute right-2 top-2 rounded-full bg-black/50 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur-sm">
                    {t("marketplace.unavailableShort")}
                  </div>
                )}
                <div className="absolute bottom-2 left-2 right-2">
                  <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[9px] font-medium text-white backdrop-blur-sm">
                    {partner.subcategory}
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
      )}

      {featuredInList && featured && featuredInList.id !== featured.id && (
        <div className="px-5 mt-3">
          <Link
            to="/parceiro/$partnerId"
            params={{ partnerId: featuredInList.id }}
            className="flex w-full items-center gap-3 rounded-2xl bg-card p-3 shadow-card text-left transition-base hover:shadow-float"
          >
            <img src={featuredInList.img} alt={featuredInList.name} loading="lazy" className="h-16 w-16 rounded-xl object-cover" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-semibold text-sm">{featuredInList.name}</span>
                {featuredInList.verified && (
                  <span className="grid h-4 w-4 place-items-center rounded-full bg-[var(--verified)] text-white">
                    <ShieldCheck size={10} strokeWidth={3} />
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {featuredInList.subcategory} · {featuredInList.location}
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <Stars value={featuredInList.rating} size={10} />
                <span className="text-[11px] text-muted-foreground">
                  {featuredInList.rating} · {featuredInList.reviews}
                </span>
              </div>
            </div>
            <span className="text-xs font-semibold text-primary">{featuredInList.price}</span>
          </Link>
        </div>
      )}

      {filteredPartners.length === 0 && (
        <div className="px-5 mt-8 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-muted">
            <Search size={24} className="text-muted-foreground" />
          </div>
          <h3 className="mt-4 font-display text-lg font-semibold">{t("marketplace.emptyTitle")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("marketplace.emptyDesc")}</p>
          <button
            onClick={() => {
              setActiveCategory("Todos");
              setSearchQuery("");
              setVerifiedOnly(false);
              setAvailableOnly(false);
            }}
            className="mt-4 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
          >
            {t("marketplace.clearFilters")}
          </button>
        </div>
      )}
    </div>
  );
}
