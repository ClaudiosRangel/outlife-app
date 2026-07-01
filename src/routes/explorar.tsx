import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { ChevronLeft, MapPin, Search, SlidersHorizontal } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { StatusBar } from "@/components/StatusBar";
import { fetchDestinations } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

const MapView = lazy(() => import("@/components/MapView"));

export const Route = createFileRoute("/explorar")({
  component: Explore,
  head: () => ({
    meta: [
      { title: "Explorar destinos — Outlife" },
      { name: "description", content: "Descubra trilhas, cachoeiras e montanhas no Brasil. Filtros por dificuldade, acessibilidade e proximidade." },
      { property: "og:title", content: "Explorar destinos — Outlife" },
      { property: "og:description", content: "Trilhas, cachoeiras e montanhas no Brasil." },
      { property: "og:url", content: "/explorar" },
    ],
    links: [{ rel: "canonical", href: "/explorar" }],
  }),
});

const filterKeys = ["all", "easy", "moderate", "hard", "accessible", "near"] as const;

function Explore() {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const { data: destinations = [], isLoading } = useQuery({
    queryKey: ["destinations"],
    queryFn: fetchDestinations,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="animate-float-up">
      <StatusBar />
      <div className="px-5 pt-2 pb-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card">
            <ChevronLeft size={18} />
          </Link>
          <span className="text-xs font-medium text-muted-foreground">{t("explore.title")}</span>
          <button className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card">
            <SlidersHorizontal size={16} />
          </button>
        </div>
        <h1 className="mt-4 font-display text-3xl font-semibold leading-tight whitespace-pre-line">
          {t("explore.headline")}
        </h1>

        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border bg-card p-3">
          <Search size={18} className="text-muted-foreground" />
          <input placeholder={t("explore.placeholder")} className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5">
          {filterKeys.map((k, i) => (
            <button key={k} className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-medium transition-base ${i === 0 ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
              {t(`explore.filters.${k}`)}
            </button>
          ))}
        </div>
      </div>

      {mounted ? (
        <Suspense fallback={<div className="mx-5 mb-5 h-40 rounded-2xl bg-gradient-sky shadow-card" />}>
          <MapView />
        </Suspense>
      ) : (
        <div className="mx-5 mb-5 h-40 rounded-2xl bg-gradient-sky shadow-card" />
      )}

      {isLoading ? (
        <div className="px-5 pb-6 grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl bg-card shadow-card">
              <Skeleton className="h-32 w-full rounded-none" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-5 pb-6 grid grid-cols-2 gap-3">
          {destinations.map((d) => (
            <Link to="/marketplace" key={d.id} className="overflow-hidden rounded-2xl bg-card shadow-card transition-base active:scale-[0.98]">
              <div className="relative h-32">
                <img src={d.img} alt={d.name} loading="lazy" className="h-full w-full object-cover" width={800} height={1024} />
                <div className="absolute right-2 top-2 rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold">★ {d.rating}</div>
                <div className="absolute inset-x-2 bottom-2 flex flex-wrap gap-1">
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">{d.type}</span>
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">{d.duration}</span>
                </div>
              </div>
              <div className="p-3">
                <div className="text-[13px] font-semibold leading-tight line-clamp-1">{d.name}</div>
                <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <MapPin size={10} /> {d.region} · {d.difficulty}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-medium text-secondary-foreground">{d.elevation}m</span>
                  <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-medium text-secondary-foreground">{d.trailType}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
