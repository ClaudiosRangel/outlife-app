/**
 * Página de detalhe de uma trilha importada (Frente H). Mesmo comportamento
 * dos destinos: hero com imagem, cards de informação (dificuldade/distância/
 * elevação), descrição, link do mapa e atribuição da fonte (OSM/ODbL).
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, MapPin, Route as RouteIcon, Mountain, Gauge, ExternalLink, Map as MapIcon, Navigation, Car } from "lucide-react";
import { fetchImportedTrailById, resolveAsset } from "@/lib/api";
import { StatusBar } from "@/components/StatusBar";
import { Skeleton } from "@/components/ui/skeleton";
import { haversineMeters } from "@/lib/haversine";
import { buildDirectionsUrl, buildMapSearchUrl, formatDistanceBR } from "@/lib/navigation-to";
import trailFallback from "@/assets/dest-trail.jpg";

export const Route = createFileRoute("/trilha/$trailId")({
  component: TrailDetailPage,
  head: ({ params }) => ({
    meta: [
      { title: "Trilha — OutVitar" },
      { name: "description", content: "Detalhes da trilha." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: `/trilha/${params.trailId}` }],
  }),
});

function TrailDetailPage() {
  const { trailId } = Route.useParams();
  const { data: trail, isLoading } = useQuery({
    queryKey: ["imported-trail", trailId],
    queryFn: () => fetchImportedTrailById(trailId),
  });

  // Posição atual (leitura única) para estimar "como chegar ao início".
  // Uma leitura única basta — usa a Web Geolocation API (disponível também no
  // WebView nativo). Se negar/indisponível, o card mostra "como chegar" sem a
  // distância estimada. Não interfere no tracker de atividade.
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (typeof navigator !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { if (!cancelled) setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
        () => { /* permissão negada / indisponível: segue sem distância */ },
        { enableHighAccuracy: false, maximumAge: 60000, timeout: 8000 },
      );
    }
    return () => { cancelled = true; };
  }, []);

  if (isLoading) {
    return (
      <div className="animate-float-up pb-24">
        <StatusBar />
        <div className="px-5 mt-4 space-y-3">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-6 w-2/3" />
          <div className="grid grid-cols-3 gap-2 pt-2">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!trail) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <Mountain size={48} className="mb-4 opacity-40" />
        <h1 className="text-xl font-semibold">Trilha não encontrada</h1>
        <p className="mt-2 text-sm text-muted-foreground">Este link pode ter expirado ou a trilha foi ocultada.</p>
        <Link to="/explorar" className="mt-4 text-sm font-medium text-primary">Voltar a Explorar</Link>
      </div>
    );
  }

  const hasCoords = trail.lat != null && trail.lng != null;
  const dest = hasCoords ? { lat: trail.lat as number, lng: trail.lng as number } : null;
  const mapsUrl = dest ? buildMapSearchUrl(dest) : null;
  // "Como chegar ao início": distância em linha reta (quando há posição) e
  // rota de carro delegada ao app de mapas nativo (padrão de mercado).
  const distanceToStart = dest && userPos ? haversineMeters(userPos, dest) : null;
  const drivingUrl = dest ? buildDirectionsUrl(dest, userPos, "driving") : null;

  return (
    <div className="animate-float-up pb-24">
      {/* Hero */}
      <div className="relative h-72">
        <img src={resolveAsset(trail.image_url, trailFallback)} alt={trail.name} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute inset-x-0 top-0 px-5 pt-3">
          <StatusBar light />
          <Link to="/explorar" className="mt-2 grid h-9 w-9 place-items-center rounded-full bg-white/20 backdrop-blur-md">
            <ChevronLeft size={18} className="text-white" />
          </Link>
        </div>
        <div className="absolute inset-x-0 bottom-0 p-5">
          <h1 className="font-display text-2xl font-semibold text-white">{trail.name}</h1>
          {trail.region && (
            <div className="mt-1 flex items-center gap-1 text-sm text-white/80">
              <MapPin size={14} /> {trail.region}
            </div>
          )}
        </div>
      </div>

      {trail.description && (
        <div className="px-5 mt-4">
          <p className="text-sm leading-relaxed text-foreground/90">{trail.description}</p>
        </div>
      )}

      {/* Cards de informação */}
      <div className="px-5 mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-card p-3 text-center shadow-card">
          <Gauge size={16} className="mx-auto text-primary" />
          <div className="mt-1 font-display text-sm font-semibold">{trail.difficulty ?? "—"}</div>
          <div className="text-[10px] text-muted-foreground">Dificuldade</div>
        </div>
        <div className="rounded-2xl bg-card p-3 text-center shadow-card">
          <RouteIcon size={16} className="mx-auto text-primary" />
          <div className="mt-1 font-display text-sm font-semibold">{trail.distance_km != null ? `${trail.distance_km} km` : "—"}</div>
          <div className="text-[10px] text-muted-foreground">Distância</div>
        </div>
        <div className="rounded-2xl bg-card p-3 text-center shadow-card">
          <Mountain size={16} className="mx-auto text-primary" />
          <div className="mt-1 font-display text-sm font-semibold">{trail.elevation_m != null ? `${Math.round(trail.elevation_m)} m` : "—"}</div>
          <div className="text-[10px] text-muted-foreground">Elevação</div>
        </div>
      </div>

      {/* Como chegar ao início — distância de carro + navegação (item 1) */}
      {drivingUrl && (
        <div className="px-5 mt-4">
          <a
            href={drivingUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-2xl bg-gradient-forest p-4 text-white shadow-card active:scale-[0.99]"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/15 backdrop-blur">
              <Car size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-display text-base font-semibold leading-tight">Como chegar ao início</div>
              <div className="text-xs text-white/80">
                {distanceToStart != null
                  ? `~${formatDistanceBR(distanceToStart)} até o ponto inicial · rota de carro`
                  : "Abrir rota de carro até o ponto inicial"}
              </div>
            </div>
            <Navigation size={18} className="shrink-0" />
          </a>
        </div>
      )}

      {/* Ações */}
      <div className="px-5 mt-4 space-y-2">
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3 text-sm font-medium"
          >
            <MapIcon size={16} className="text-primary" /> Ver no mapa
          </a>
        )}
        {trail.website && (
          <a
            href={trail.website}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3 text-sm font-medium"
          >
            <ExternalLink size={16} className="text-primary" /> Site oficial
          </a>
        )}
      </div>

      {/* Atribuição da fonte */}
      {trail.attribution && (
        <div className="px-5 mt-6 text-center">
          <p className="text-[11px] text-muted-foreground/80">
            {trail.attribution}{trail.license ? ` · ${trail.license}` : ""}
          </p>
        </div>
      )}
    </div>
  );
}
