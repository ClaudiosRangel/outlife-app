// Tela de detalhe do Destino (Bloco 3, Fase A). Ficha rica: hero, badges
// (dificuldade/categoria/pago), descrição, mapa com o traçado real (route_geojson),
// favoritar e "Iniciar navegação". Clima/elevação/amigos entram nas fases B.
// Rota flat /destino/$destinationId (routeTree manual).

import { lazy, Suspense, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Route as RouteIcon, Bookmark, BookmarkCheck, Navigation, AlertTriangle, PawPrint, DollarSign, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { StatusBar } from "@/components/StatusBar";
import { Skeleton } from "@/components/ui/skeleton";
import { SafeImage } from "@/components/SafeImage";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchDestinationById,
  fetchSavedDestinations,
  saveDestination,
  unsaveDestination,
} from "@/lib/api";
import waterfall from "@/assets/cachoeira_do_tabuleiro.jpg";

const DestinationRouteMap = lazy(() => import("@/components/DestinationRouteMap"));

export const Route = createFileRoute("/destino/$destinationId")({
  component: DestinationScreen,
  head: () => ({
    meta: [
      { title: "Destino — OutVitar" },
      { name: "description", content: "Detalhes do destino: rota, dificuldade e informações." },
    ],
  }),
});

const DIFFICULTY_COLOR: Record<string, string> = {
  "Fácil": "#22c55e",
  "Moderada": "#eab308",
  "Difícil": "#f97316",
  "Avançada": "#ef4444",
  "Muito difícil": "#dc2626",
};

function DestinationScreen() {
  const { t } = useTranslation();
  const { destinationId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: dest, isLoading } = useQuery({
    queryKey: ["destination", destinationId],
    queryFn: () => fetchDestinationById(destinationId),
  });

  const { data: saved = [] } = useQuery({
    queryKey: ["saved-destinations"],
    queryFn: () => fetchSavedDestinations(),
    enabled: !!user,
  });
  const isSaved = saved.some((s) => s.destination_id === destinationId);

  const [savingFav, setSavingFav] = useState(false);
  const favMut = useMutation({
    mutationFn: async () => {
      setSavingFav(true);
      if (isSaved) await unsaveDestination(destinationId);
      else await saveDestination(destinationId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-destinations"] }),
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setSavingFav(false),
  });

  if (isLoading) {
    return (
      <div className="pb-10">
        <Skeleton className="h-64 w-full" />
        <div className="mx-5 mt-4 space-y-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!dest) {
    return (
      <div className="grid min-h-[60vh] place-items-center px-8 text-center text-sm text-muted-foreground">
        {t("destination.notFound", { defaultValue: "Destino não encontrado." })}
      </div>
    );
  }

  const diffColor = DIFFICULTY_COLOR[dest.difficulty] ?? "#64748b";
  const coords = dest.routeGeojson?.coordinates?.map((c) => ({ lat: c[1], lng: c[0] })) ?? [];
  const hasRoute = coords.length >= 2;

  return (
    <div className="pb-28">
      {/* Hero */}
      <div className="relative h-64 w-full overflow-hidden">
        <SafeImage src={dest.img || waterfall} alt={dest.name} aspectClassName="h-64 w-full" fallbackSrc={waterfall} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[env(safe-area-inset-top,12px)]">
          <StatusBar light />
        </div>
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top,12px)+8px)]">
          <button
            onClick={() => navigate({ to: "/explorar" })}
            className="grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur active:scale-95"
            aria-label={t("common.back", { defaultValue: "Voltar" })}
          >
            <ArrowLeft size={18} />
          </button>
          <button
            onClick={() => favMut.mutate()}
            disabled={savingFav || !user}
            className="grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur active:scale-95 disabled:opacity-60"
            aria-label={t("destination.save", { defaultValue: "Favoritar" })}
          >
            {isSaved ? <BookmarkCheck size={18} className="text-[#f97316]" /> : <Bookmark size={18} />}
          </button>
        </div>
      </div>

      {/* Cabeçalho: badges + nome + local */}
      <div className="mx-5 -mt-6 rounded-3xl bg-card p-4 shadow-card">
        <div className="flex flex-wrap gap-2">
          {dest.difficulty && (
            <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-white" style={{ backgroundColor: diffColor }}>
              {dest.difficulty}
            </span>
          )}
          {dest.category && (
            <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold capitalize text-secondary-foreground">
              {dest.category}
            </span>
          )}
          {dest.isPaid === true && (
            <span className="flex items-center gap-1 rounded-full bg-red-500 px-2.5 py-1 text-[11px] font-semibold text-white">
              <DollarSign size={11} /> {t("destination.paid", { defaultValue: "Pago" })}
            </span>
          )}
          {dest.isPaid === false && (
            <span className="rounded-full bg-green-600 px-2.5 py-1 text-[11px] font-semibold text-white">
              {t("destination.free", { defaultValue: "Gratuito" })}
            </span>
          )}
          {dest.petFriendly && (
            <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-secondary-foreground">
              <PawPrint size={11} /> Pet
            </span>
          )}
        </div>
        <h1 className="mt-3 font-display text-2xl font-bold leading-tight">{dest.name}</h1>
        {(dest.region || dest.state) && (
          <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin size={14} /> {[dest.region, dest.state].filter(Boolean).join(" - ")}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
          {(dest.distanceKm != null || dest.distance) && (
            <span className="flex items-center gap-1">
              <RouteIcon size={13} className="text-primary" />
              {dest.distanceKm != null ? `${dest.distanceKm} km` : dest.distance}
            </span>
          )}
          {dest.duration && (
            <span className="flex items-center gap-1"><Clock size={13} className="text-primary" /> {dest.duration}</span>
          )}
          {dest.elevation > 0 && (
            <span className="flex items-center gap-1">↗ {dest.elevation} m</span>
          )}
        </div>
      </div>

      {/* Info de visitação (horário/preço) */}
      {(dest.openingHours || dest.priceText) && (
        <div className="mx-5 mt-3 rounded-2xl bg-card p-4 shadow-card text-sm">
          {dest.openingHours && (
            <div className="flex items-start gap-2"><Clock size={15} className="mt-0.5 text-primary" /> {dest.openingHours}</div>
          )}
          {dest.priceText && (
            <div className="mt-1.5 flex items-start gap-2"><DollarSign size={15} className="mt-0.5 text-primary" /> {dest.priceText}</div>
          )}
        </div>
      )}

      {/* Mapa da rota */}
      {hasRoute && (
        <div className="mx-5 mt-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t("destination.routeMap", { defaultValue: "Mapa da rota" })}
          </div>
          <Suspense fallback={<Skeleton className="h-56 w-full rounded-2xl" />}>
            <DestinationRouteMap path={coords} height={240} />
          </Suspense>
        </div>
      )}

      {/* Sobre */}
      {dest.description && (
        <div className="mx-5 mt-3 rounded-2xl bg-card p-4 shadow-card">
          <div className="mb-1 text-sm font-semibold">{t("destination.about", { defaultValue: "Sobre a trilha" })}</div>
          <p className="text-sm leading-relaxed text-foreground/90">{dest.description}</p>
        </div>
      )}

      {/* Aviso de segurança */}
      <div className="mx-5 mt-3 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/20">
        <div className="flex items-center gap-2 text-sm font-semibold text-red-600 dark:text-red-400">
          <AlertTriangle size={16} /> {t("destination.safetyTitle", { defaultValue: "Pratique com segurança" })}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-red-600/80 dark:text-red-400/80">
          {t("destination.safetyText", {
            defaultValue: "Trilhas podem sofrer alterações por condições climáticas e fatores externos. A decisão de utilização é de responsabilidade do usuário, que assume os riscos envolvidos.",
          })}
        </p>
      </div>

      {/* CTA fixo: Iniciar navegação */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-4 pb-[calc(env(safe-area-inset-bottom,12px)+12px)] backdrop-blur">
        <button
          onClick={() => navigate({ to: "/atividade/rastrear" })}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#f97316] py-3.5 text-sm font-bold text-white active:scale-[0.98]"
        >
          <Navigation size={18} /> {t("destination.startNav", { defaultValue: "Iniciar navegação" })}
        </button>
      </div>
    </div>
  );
}
