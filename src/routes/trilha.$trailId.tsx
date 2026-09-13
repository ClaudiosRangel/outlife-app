/**
 * Página de detalhe de uma trilha importada (Frente H). Mesmo comportamento
 * dos destinos: hero com imagem, cards de informação (dificuldade/distância/
 * elevação), descrição, link do mapa e atribuição da fonte (OSM/ODbL).
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, MapPin, Route as RouteIcon, Mountain, Gauge, ExternalLink, Map as MapIcon } from "lucide-react";
import { fetchImportedTrailById, resolveAsset } from "@/lib/api";
import { StatusBar } from "@/components/StatusBar";
import { Skeleton } from "@/components/ui/skeleton";
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
  const mapsUrl = hasCoords ? `https://www.google.com/maps/search/?api=1&query=${trail.lat},${trail.lng}` : null;

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
