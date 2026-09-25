import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, MapPin, Search, SlidersHorizontal, WifiOff, Car } from "lucide-react";
import { haversineMeters } from "@/lib/haversine";
import { formatDistanceBR } from "@/lib/navigation-to";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { StatusBar } from "@/components/StatusBar";
import { LiveFriendsList } from "@/components/LiveFriendsList";
import {
  fetchDestinations,
  fetchLiveActivityFriends,
  fetchMyProfile,
  fetchPartners,
  fetchVisibleImportedTrails,
  resolveAsset,
  type Destination,
  type Difficulty,
} from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { PartnerList } from "@/components/PartnerList";
import { useAuth } from "@/hooks/use-auth";
import { useLiveActivityPublisher } from "@/hooks/use-live-activity-publisher";
import { ExploreMap } from "@/components/explore/ExploreMap";
import { ExplorePanorama } from "@/components/explore/ExplorePanorama";
import { filterNearby, type NowMarker } from "@/lib/nearby";
import { buildPanorama } from "@/lib/explore-panorama";
import { geocodePlace } from "@/lib/geocode";
import { fetchNearbyEvents } from "@/lib/api";
import { ExploreSearch } from "@/components/explore/ExploreSearch";
import trailFallbackImg from "@/assets/dest-trail.jpg";

export const Route = createFileRoute("/explorar")({
  component: Explore,
  head: () => ({
    meta: [
      { title: "Explorar destinos — OutVitar" },
      { name: "description", content: "Descubra trilhas, cachoeiras e montanhas no Brasil. Filtros por dificuldade, acessibilidade e proximidade." },
      { property: "og:title", content: "Explorar destinos — OutVitar" },
      { property: "og:description", content: "Trilhas, cachoeiras e montanhas no Brasil." },
      { property: "og:url", content: "/explorar" },
    ],
    links: [{ rel: "canonical", href: "/explorar" }],
  }),
});

const filterKeys = ["all", "easy", "moderate", "hard", "accessible", "near"] as const;

// Mapeia as chaves de dificuldade do filtro para os valores em português persistidos em `destinations.difficulty`.
// "accessible" e "near" não filtram por dificuldade: não há campo de acessibilidade ou proximidade geográfica
// disponível em `Destination` hoje, então esses chips permanecem apenas com destaque visual (sem restringir a lista).
const DIFFICULTY_LABELS: Record<"easy" | "moderate" | "hard", string> = {
  easy: "Fácil",
  moderate: "Moderada",
  hard: "Difícil",
};

/**
 * Função pura de filtro por dificuldade. Retorna exatamente os destinos cuja dificuldade
 * corresponde à chave selecionada, ou todos os destinos quando `difficulty` é "all" ou
 * corresponde a um chip sem critério de dificuldade associado ("accessible"/"near").
 */
export function filterDestinationsByDifficulty(
  destinations: Destination[],
  difficulty: Difficulty | "all",
): Destination[] {
  if (difficulty !== "easy" && difficulty !== "moderate" && difficulty !== "hard") {
    return destinations;
  }
  const label = DIFFICULTY_LABELS[difficulty];
  return destinations.filter((d) => d.difficulty === label);
}

function Explore() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  // Ponto 1: acompanhamento ao vivo depende de internet. Detecta o estado de
  // conexão para avisar o usuário quando estiver offline (o "ao vivo" não
  // funciona sem rede — é uma função inerentemente online).
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | "all">("all");
  // Aba ativa: Destinos (comportamento atual) ou Parceiros (item 8 — concentra
  // a descoberta de parceiros na Explorar).
  const [exploreTab, setExploreTab] = useState<"destinos" | "parceiros">("destinos");
  const [partnerQuery, setPartnerQuery] = useState("");
  // Amigo selecionado na Live_Friends_List; alimenta o MapView para centralizar
  // e destacar o marcador (Req 4.1/4.2). Limpo quando o amigo deixa de estar ao
  // vivo (Req 4.4).
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  // Região selecionada na busca (fase 3): ao escolher uma cidade, o mapa e o
  // panorama passam a refletir aquela região.
  const [searchedRegion, setSearchedRegion] = useState<{ name: string; lat: number; lng: number } | null>(null);

  const { data: destinations = [], isLoading } = useQuery({
    queryKey: ["destinations"],
    queryFn: fetchDestinations,
  });

  // Frente H (Req 1): trilhas importadas liberadas pela curadoria (visible=true).
  const { data: importedTrails = [] } = useQuery({
    queryKey: ["imported-trails-visible"],
    queryFn: fetchVisibleImportedTrails,
    // Carrega sempre: alimenta a busca unificada (destinos/trilhas) e o painel,
    // não só a lista da aba Destinos.
  });

  // Parceiros: usados tanto na aba Parceiros quanto na camada "agora" do mapa
  // (marcadores de parceiros próximos), por isso carregam sempre.
  const { data: partners = [], isLoading: partnersLoading } = useQuery({
    queryKey: ["partners"],
    queryFn: fetchPartners,
  });

  const filteredPartners = useMemo(() => {
    const q = partnerQuery.trim().toLowerCase();
    if (!q) return partners;
    return partners.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.tags.some((tag) => tag.toLowerCase().includes(q)),
    );
  }, [partners, partnerQuery]);

  // Mesma key ["shared-locations"] usada pelo MapView (Req 6.3) — fonte única de
  // verdade com `fetchLiveActivityFriends` (VIEW superset). O refetchInterval
  // coincide com o do MapView (60s) para reaproveitar o mesmo mecanismo de
  // atualização periódica, sem polling adicional. A exclusão do próprio usuário
  // já é garantida dentro de `fetchLiveActivityFriends`.
  const { data: liveFriends = [] } = useQuery({
    queryKey: ["shared-locations"],
    queryFn: fetchLiveActivityFriends,
    // Tempo real (~15s, alinhado ao intervalo de publicação do celular que
    // está gravando): a posição dos amigos atualiza sozinha, sem depender do
    // botão "Atualizar agora". Continua atualizando em background e ao focar.
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    enabled: !!user,
  });

  // Perfil do próprio usuário: fonte do `location_sharing_mode` (mesma key
  // ["my-profile", id] que o MapView usa), reaproveitada como `sharingMode` do
  // publisher.
  const { data: myProfile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: fetchMyProfile,
    enabled: !!user,
  });

  // Decisão sobre a fonte do tracker (documentada): NÃO existe um contexto/
  // instância compartilhada do Activity_Tracker no app — o `useActivityTracker`
  // só é instanciado na tela de rastreamento (`atividade.rastrear.tsx`), e ao
  // montar ele restaura atividades persistidas ABRINDO um `watchPosition`
  // (nativo/web). Instanciá-lo aqui, na Explore, duplicaria a captura de GPS de
  // um usuário que estivesse rastreando e navegasse para cá — violando o
  // requisito de bateria/rede (Req 6.1). Como a publicação ao vivo de fato
  // ocorre na tela de rastreamento (que já tem o tracker + o publisher próprios),
  // aqui montamos o publisher de forma INERTE (`status: 'idle'`, `currentPos:
  // null`), reaproveitando apenas o `location_sharing_mode` já disponível via
  // ["my-profile"]. Com `status !== 'tracking'` o publisher não obtém nem
  // envia posição — não abre nenhum watch.
  useLiveActivityPublisher({
    status: "idle",
    currentPos: null,
    sharingMode: myProfile?.location_sharing_mode,
    permissionDenied: false,
  });

  const filteredDestinations = useMemo(
    () => filterDestinationsByDifficulty(destinations, difficultyFilter),
    [destinations, difficultyFilter],
  );

  // Centro do mapa/panorama: prioriza a REGIÃO BUSCADA (ex.: "Juiz de Fora");
  // senão a minha posição compartilhada.
  const mapCenter = useMemo(() => {
    if (searchedRegion) return { lat: searchedRegion.lat, lng: searchedRegion.lng };
    const lat = myProfile?.latitude != null ? Number(myProfile.latitude) : null;
    const lng = myProfile?.longitude != null ? Number(myProfile.longitude) : null;
    return lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)
      ? { lat, lng }
      : null;
  }, [searchedRegion, myProfile?.latitude, myProfile?.longitude]);

  const regionName = searchedRegion?.name ?? myProfile?.location ?? null;

  // Eventos futuros para o panorama e o mapa.
  const { data: rawEvents = [] } = useQuery({
    queryKey: ["nearby-events"],
    queryFn: () => fetchNearbyEvents(50),
  });

  // Geocodifica os pontos de encontro dos eventos SEM destino/coords (ex.:
  // "Lapa") para poder plotá-los no mapa. Em lote, memoizado por texto único.
  const meetingPointsToGeocode = useMemo(
    () =>
      Array.from(
        new Set(
          rawEvents
            .filter((e) => (e.lat == null || e.lng == null) && e.meetingPoint)
            .map((e) => e.meetingPoint as string),
        ),
      ),
    [rawEvents],
  );
  const { data: geocodedPoints = {} } = useQuery({
    queryKey: ["event-meeting-geocode", meetingPointsToGeocode],
    queryFn: async () => {
      const out: Record<string, { lat: number; lng: number }> = {};
      for (const mp of meetingPointsToGeocode) {
        const r = await geocodePlace(mp);
        if (r) out[mp] = { lat: r.lat, lng: r.lng };
      }
      return out;
    },
    enabled: meetingPointsToGeocode.length > 0,
    staleTime: 60 * 60_000,
  });

  // Eventos com coords resolvidas (destino OU ponto de encontro geocodificado).
  const nearbyEvents = useMemo(
    () =>
      rawEvents.map((e) => {
        if (e.lat != null && e.lng != null) return e;
        const g = e.meetingPoint ? geocodedPoints[e.meetingPoint] : null;
        return g ? { ...e, lat: g.lat, lng: g.lng } : e;
      }),
    [rawEvents, geocodedPoints],
  );

  // Camada "o que acontece agora": amigos ao vivo + parceiros próximos.
  const nowMarkers = useMemo<NowMarker[]>(() => {
    const friends: NowMarker[] = liveFriends
      .filter((f) => f.is_live)
      .map((f) => ({
        id: `friend:${f.id}`,
        kind: "friend" as const,
        lat: f.latitude,
        lng: f.longitude,
        title: f.full_name ?? f.username ?? "Aventureiro",
        subtitle: f.activity_type ?? undefined,
        avatarUrl: f.avatar_url,
        href: `/u/${f.id}`,
      }));
    const partnerMarkers: NowMarker[] = partners
      .filter((p) => p.coords != null)
      .map((p) => ({
        id: `partner:${p.id}`,
        kind: "partner" as const,
        lat: p.coords!.lat,
        lng: p.coords!.lng,
        title: p.name,
        subtitle: p.category,
        href: `/parceiro/${p.id}`,
      }));
    const eventMarkers: NowMarker[] = nearbyEvents
      .filter((e) => e.lat != null && e.lng != null)
      .map((e) => ({
        id: `event:${e.id}`,
        kind: "event" as const,
        lat: e.lat!,
        lng: e.lng!,
        title: e.title,
        href: `/eventos`,
      }));
    return filterNearby([...friends, ...partnerMarkers, ...eventMarkers], mapCenter, { limit: 80 });
  }, [liveFriends, partners, nearbyEvents, mapCenter]);

  // Panorama "agora na região": contadores + destaques (o que não cabe em pino).
  const panorama = useMemo(
    () =>
      buildPanorama({
        center: mapCenter,
        friends: liveFriends
          .filter((f) => f.is_live)
          .map((f) => ({
            id: f.id,
            name: f.full_name ?? f.username ?? "Aventureiro",
            lat: f.latitude,
            lng: f.longitude,
            activityType: f.activity_type ?? null,
          })),
        partners: partners
          .filter((p) => p.coords != null)
          .map((p) => ({ id: p.id, name: p.name, lat: p.coords!.lat, lng: p.coords!.lng })),
        destinations: destinations
          .filter((d) => (d as { latitude?: number | null }).latitude != null)
          .map((d) => {
            const dd = d as unknown as { id: string; name: string; latitude: number; longitude: number; rating?: number };
            return { id: dd.id, name: dd.name, lat: Number(dd.latitude), lng: Number(dd.longitude), rating: Number(dd.rating ?? 0) };
          }),
        trails: importedTrails
          .filter((tr) => (tr as { latitude?: number | null }).latitude != null)
          .map((tr) => {
            const tt = tr as unknown as { id: string; name: string; latitude: number; longitude: number };
            return { id: tt.id, name: tt.name, lat: Number(tt.latitude), lng: Number(tt.longitude) };
          }),
        events: nearbyEvents.map((e) => ({ id: e.id, title: e.title, dateIso: e.dateIso, lat: e.lat, lng: e.lng })),
      }),
    [mapCenter, liveFriends, partners, destinations, importedTrails, nearbyEvents],
  );

  // Lugares (destinos + trilhas) próximos como marcadores, para o contador
  // "lugares" abrir a lista e para o card de "perto de você" (item 5).
  const placeMarkers = useMemo<NowMarker[]>(() => {
    const dests: NowMarker[] = destinations
      .filter((d) => (d as { latitude?: number | null }).latitude != null)
      .map((d) => {
        const dd = d as unknown as { id: string; name: string; latitude: number; longitude: number; region?: string };
        return {
          id: `dest:${dd.id}`,
          kind: "event" as const, // reutiliza pino; navegação via href
          lat: Number(dd.latitude),
          lng: Number(dd.longitude),
          title: dd.name,
          subtitle: dd.region,
          href: `/destino/${dd.id}`,
        };
      });
    const trls: NowMarker[] = importedTrails
      .filter((tr) => (tr as { latitude?: number | null }).latitude != null)
      .map((tr) => {
        const tt = tr as unknown as { id: string; name: string; latitude: number; longitude: number; region?: string };
        return {
          id: `trail:${tt.id}`,
          kind: "event" as const,
          lat: Number(tt.latitude),
          lng: Number(tt.longitude),
          title: tt.name,
          subtitle: tt.region,
          href: `/trilha/${tt.id}`,
        };
      });
    return filterNearby([...dests, ...trls], mapCenter, { limit: 40 });
  }, [destinations, importedTrails, mapCenter]);

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

        {/* Abas Destinos/Parceiros (item 8). */}
        <div className="mt-4 flex gap-2">
          {(["destinos", "parceiros"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setExploreTab(tab)}
              className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-base ${
                exploreTab === tab ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
              }`}
            >
              {t(`explore.tabs.${tab}`)}
            </button>
          ))}
        </div>

        {exploreTab === "destinos" ? (
          <>
            {/* Busca unificada (fase 3.2): cidades + amigos + parceiros +
                eventos, com sugestões. Cidade recentra o panorama; os demais
                navegam. */}
            <div className="mt-4">
              <ExploreSearch
                partners={partners}
                events={nearbyEvents}
                destinations={destinations.map((d) => {
                  const dd = d as unknown as { id: string; name: string; region?: string | null };
                  return { id: dd.id, name: dd.name, region: dd.region };
                })}
                trails={importedTrails.map((tr) => {
                  const tt = tr as unknown as { id: string; name: string; region?: string | null };
                  return { id: tt.id, name: tt.name, region: tt.region };
                })}
                placeholder={t("explore.placeholder")}
                onPick={(r) => {
                  if (r.kind === "region") setSearchedRegion({ name: r.label, lat: r.lat, lng: r.lng });
                  else if (r.kind === "friend") navigate({ to: "/u/$userId", params: { userId: r.userId } });
                  else if (r.kind === "partner") navigate({ to: "/parceiro/$partnerId", params: { partnerId: r.partnerId } });
                  else if (r.kind === "event") navigate({ to: "/eventos" });
                  else if (r.kind === "destination") navigate({ to: "/destino/$destinationId", params: { destinationId: r.destinationId } });
                  else if (r.kind === "trail") navigate({ to: "/trilha/$trailId", params: { trailId: r.trailId } });
                }}
              />
            </div>

            {/* Chip da região buscada (fase 3): mostra e permite limpar. */}
            {searchedRegion && (
              <button
                onClick={() => setSearchedRegion(null)}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
              >
                <MapPin size={12} /> {searchedRegion.name}
                <span className="ml-1 text-primary/70">✕</span>
              </button>
            )}

            <div className="mt-4 flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5">
              {filterKeys.map((k) => (
                <button
                  key={k}
                  onClick={() => setDifficultyFilter(k)}
                  className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-medium transition-base ${difficultyFilter === k ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
                >
                  {t(`explore.filters.${k}`)}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border bg-card p-3">
            <Search size={18} className="text-muted-foreground" />
            <input
              value={partnerQuery}
              onChange={(e) => setPartnerQuery(e.target.value)}
              placeholder={t("marketplace.searchPlaceholder")}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        )}
      </div>

      {exploreTab === "parceiros" ? (
        <div className="px-5 pb-6">
          {partnersLoading ? (
            <div className="grid grid-cols-2 gap-3">
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
          ) : filteredPartners.length === 0 ? (
            <div className="rounded-2xl bg-card p-6 text-center text-xs text-muted-foreground shadow-card">
              {t("marketplace.emptyTitle")}
            </div>
          ) : (
            <PartnerList partners={filteredPartners} />
          )}

          {/* Link para os filtros avançados do marketplace (Req 6.2). */}
          <Link
            to="/marketplace"
            className="mt-4 flex items-center justify-between rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4"
          >
            <span className="text-sm font-semibold text-primary">{t("explore.allPartnerFilters")}</span>
            <span className="text-xs font-medium text-primary">→</span>
          </Link>
        </div>
      ) : (
        <>
      <ExplorePanorama
        panorama={panorama}
        center={mapCenter}
        regionName={regionName}
        friendMarkers={nowMarkers.filter((m) => m.kind === "friend")}
        partnerMarkers={nowMarkers.filter((m) => m.kind === "partner")}
        eventMarkers={nowMarkers.filter((m) => m.kind === "event")}
        placeMarkers={placeMarkers}
        onOpen={(href) => navigate({ to: href })}
      />

      {mounted ? (
        <ExploreMap
          markers={nowMarkers}
          center={mapCenter}
          selectedFriendId={selectedFriendId}
          onSelectedFriendUnavailable={() => {
            // O amigo selecionado deixou de estar ao vivo (Req 4.4): avisa o
            // usuário e limpa a seleção.
            toast(t("liveFriends.unavailable"));
            setSelectedFriendId(null);
          }}
          onMarkerClick={(m) => {
            if (m.href) navigate({ to: m.href });
          }}
        />
      ) : (
        <div className="mx-5 mb-3 h-72 rounded-3xl bg-gradient-sky shadow-card" />
      )}

      {/* Lista de amigos em atividade ao vivo, logo abaixo do mapa (Req 3.1).
          `is_live` já é filtrado aqui; a exclusão do próprio usuário vem de
          `fetchLiveActivityFriends`. */}
      {!isOnline && (
        <div className="mx-5 mb-2 flex items-start gap-2 rounded-2xl border border-amber-300/40 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
          <WifiOff size={16} className="mt-0.5 shrink-0" />
          <span>{t("liveFriends.offlineNotice", "Sem internet — o acompanhamento ao vivo fica indisponível. Sua atividade continua sendo gravada normalmente e sincroniza quando a conexão voltar.")}</span>
        </div>
      )}

      <div className="pb-6">
        <LiveFriendsList
          friends={liveFriends.filter((f) => f.is_live)}
          onSelectFriend={setSelectedFriendId}
        />
      </div>

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
          {filteredDestinations.map((d) => (
            <Link
              to="/destino/$destinationId"
              params={{ destinationId: d.id }}
              key={d.id}
              className="group relative overflow-hidden rounded-3xl shadow-card transition-base active:scale-[0.98]"
            >
              {/* Card imersivo: imagem cobre tudo + gradiente + texto sobre a foto. */}
              <div className="relative h-48">
                <img
                  src={d.img}
                  alt={d.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-active:scale-105"
                  width={800}
                  height={1024}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                {/* Rating no topo */}
                <div className="absolute right-2 top-2 flex items-center gap-0.5 rounded-full bg-black/40 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-md">
                  ★ {d.rating}
                </div>
                {/* Dificuldade no topo esquerdo */}
                <span className="absolute left-2 top-2 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-semibold text-primary-foreground backdrop-blur-md">
                  {d.difficulty}
                </span>
                {/* Conteúdo sobre a foto */}
                <div className="absolute inset-x-3 bottom-2.5">
                  <div className="line-clamp-1 text-sm font-bold text-white drop-shadow">{d.name}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-[10px] text-white/85">
                    <MapPin size={10} /> {d.region}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-medium text-white backdrop-blur-sm">{d.type}</span>
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-medium text-white backdrop-blur-sm">{d.duration}</span>
                    {d.elevation ? (
                      <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-medium text-white backdrop-blur-sm">{d.elevation}m</span>
                    ) : null}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Frente H (Req 1): trilhas importadas liberadas pela curadoria.
          Atribuição OSM exibida no rodapé quando houver item de origem osm. */}
      {exploreTab === "destinos" && importedTrails.length > 0 && (
        <div className="px-5 pb-2">
          <h2 className="font-display text-sm font-semibold text-muted-foreground">
            {t("explore.trailsTitle", "Trilhas")}
          </h2>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {importedTrails.map((trail) => {
              const tlat = (trail as { latitude?: number | null }).latitude;
              const tlng = (trail as { longitude?: number | null }).longitude;
              const toStart =
                mapCenter && tlat != null && tlng != null
                  ? haversineMeters(mapCenter, { lat: Number(tlat), lng: Number(tlng) })
                  : null;
              return (
              <Link
                to="/trilha/$trailId"
                params={{ trailId: trail.id }}
                key={trail.id}
                className="overflow-hidden rounded-2xl bg-card shadow-card transition-base active:scale-[0.98]"
              >
                <div className="relative h-28">
                  <img
                    src={resolveAsset(trail.image_url, trailFallbackImg)}
                    alt={trail.name}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="p-3">
                  <div className="text-[13px] font-semibold leading-tight line-clamp-1">{trail.name}</div>
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <MapPin size={10} /> {trail.region ?? t("explore.trailsSource", "Trilha importada")}
                  </div>
                  {/* Como chegar: distância aproximada (linha reta) até o início */}
                  {toStart != null && (
                    <div className="mt-1 flex items-center gap-1 text-[10px] font-medium text-primary">
                      <Car size={11} /> ~{formatDistanceBR(toStart)} {t("explore.toStart", "até o início")}
                    </div>
                  )}
                  {(trail.difficulty || trail.distance_km != null) && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {trail.difficulty && (
                        <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-medium text-secondary-foreground">{trail.difficulty}</span>
                      )}
                      {trail.distance_km != null && (
                        <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-medium text-secondary-foreground">{trail.distance_km} km</span>
                      )}
                    </div>
                  )}
                </div>
              </Link>
              );
            })}
          </div>
          {importedTrails.some((tr) => tr.external_source === "osm") && (
            <p className="mt-2 text-[10px] text-muted-foreground/80">
              © OpenStreetMap contributors · ODbL
            </p>
          )}
        </div>
      )}

      {/* CTA sugerir destino */}
      <div className="px-5 pb-6 mt-4">
        <Link to="/sugerir-destino" className="flex items-center justify-between rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4">
          <div>
            <span className="text-sm font-semibold text-primary">Conhece um destino incrível?</span>
            <p className="text-xs text-muted-foreground mt-0.5">Envie para aprovação e ele aparecerá para todos</p>
          </div>
          <span className="text-xs font-medium text-primary">Sugerir →</span>
        </Link>
      </div>
        </>
      )}
    </div>
  );
}
