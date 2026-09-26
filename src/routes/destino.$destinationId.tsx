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
  fetchFriendsOnDestination,
  fetchPartners,
  resolveAsset,
} from "@/lib/api";
import { haversineMeters } from "@/lib/haversine";
import { SafeImage as Avatar } from "@/components/SafeImage";
import waterfall from "@/assets/cachoeira_do_tabuleiro.jpg";
import avatarFallback from "@/assets/avatar-rafael.jpg";

const DestinationRouteMap = lazy(() => import("@/components/DestinationRouteMap"));
const DestinationWeather = lazy(() => import("@/components/DestinationWeather"));
const ElevationChart = lazy(() => import("@/components/ElevationChart"));

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
  const isSaved = saved.some((s) => s.id === destinationId);

  // Amigos que estão/estiveram na trilha (Fase B).
  const { data: friends = [] } = useQuery({
    queryKey: ["friends-on-destination", destinationId],
    queryFn: () => fetchFriendsOnDestination(destinationId),
    enabled: !!user,
  });

  // Parceiros próximos do destino (por proximidade, cliente).
  const { data: allPartners = [] } = useQuery({
    queryKey: ["partners"],
    queryFn: fetchPartners,
    staleTime: 5 * 60 * 1000,
  });

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

  // Coordenada de referência do destino (start da rota ou lat/lng).
  const destLat = dest.startLat ?? dest.latitude ?? coords[0]?.lat ?? null;
  const destLng = dest.startLng ?? dest.longitude ?? coords[0]?.lng ?? null;

  // Parceiros num raio de ~30 km do destino.
  const nearbyPartners = destLat != null && destLng != null
    ? allPartners
        .filter((p) => p.coords != null)
        .map((p) => ({ p, dist: haversineMeters({ lat: destLat, lng: destLng }, p.coords!) }))
        .filter((x) => x.dist <= 30000)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 8)
        .map((x) => x.p)
    : [];

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

      {/* Clima (Open-Meteo) — silencioso se não carregar. */}
      {destLat != null && destLng != null && (
        <Suspense fallback={null}>
          <DestinationWeather lat={destLat} lng={destLng} />
        </Suspense>
      )}

      {/* Perfil de elevação (silencioso se não houver dados). */}
      {dest.elevationProfile && dest.elevationProfile.length >= 2 && (
        <Suspense fallback={null}>
          <ElevationChart points={dest.elevationProfile} />
        </Suspense>
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

      {/* Amigos na trilha */}
      {friends.length > 0 && (
        <div className="mx-5 mt-3 rounded-2xl bg-card p-4 shadow-card">
          <div className="mb-2 text-sm font-semibold">
            {t("destination.friendsOnTrail", { defaultValue: "Amigos nesta trilha" })}
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide">
            {friends.map((f) => (
              <Link key={f.userId} to="/u/$userId" params={{ userId: f.userId }} className="flex shrink-0 flex-col items-center gap-1" style={{ width: 56 }}>
                <div className="h-12 w-12 overflow-hidden rounded-full ring-2 ring-primary/30">
                  <Avatar src={resolveAsset(f.avatarUrl, avatarFallback)} alt={f.fullName ?? ""} aspectClassName="aspect-square" fallbackSrc={avatarFallback} />
                </div>
                <span className="w-full truncate text-center text-[10px] text-muted-foreground">
                  {f.fullName?.split(" ")[0] ?? (f.username ? `@${f.username}` : "")}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Parceiros na região */}
      {nearbyPartners.length > 0 && (
        <div className="mx-5 mt-3 rounded-2xl bg-card p-4 shadow-card">
          <div className="mb-2 text-sm font-semibold">
            {t("destination.partnersNearby", { defaultValue: "Parceiros na região" })}
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide">
            {nearbyPartners.map((p) => (
              <Link key={p.id} to="/parceiro/$partnerId" params={{ partnerId: p.id }} className="w-36 shrink-0">
                <div className="h-20 w-full overflow-hidden rounded-xl">
                  <Avatar src={resolveAsset(p.img, avatarFallback)} alt={p.name} aspectClassName="h-20 w-full" fallbackSrc={avatarFallback} />
                </div>
                <div className="mt-1 truncate text-xs font-semibold">{p.name}</div>
                <div className="truncate text-[10px] text-muted-foreground">{p.category}</div>
              </Link>
            ))}
          </div>
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
