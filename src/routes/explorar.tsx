import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { ChevronLeft, MapPin, Search, SlidersHorizontal } from "lucide-react";
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
  type Destination,
  type Difficulty,
} from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { PartnerList } from "@/components/PartnerList";
import { useAuth } from "@/hooks/use-auth";
import { useLiveActivityPublisher } from "@/hooks/use-live-activity-publisher";

const MapView = lazy(() => import("@/components/MapView"));

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
  const [mounted, setMounted] = useState(false);
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | "all">("all");
  // Aba ativa: Destinos (comportamento atual) ou Parceiros (item 8 — concentra
  // a descoberta de parceiros na Explorar).
  const [exploreTab, setExploreTab] = useState<"destinos" | "parceiros">("destinos");
  const [partnerQuery, setPartnerQuery] = useState("");
  // Amigo selecionado na Live_Friends_List; alimenta o MapView para centralizar
  // e destacar o marcador (Req 4.1/4.2). Limpo quando o amigo deixa de estar ao
  // vivo (Req 4.4).
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);

  const { data: destinations = [], isLoading } = useQuery({
    queryKey: ["destinations"],
    queryFn: fetchDestinations,
  });

  // Parceiros para a aba Parceiros (item 8). Só busca quando a aba está ativa.
  const { data: partners = [], isLoading: partnersLoading } = useQuery({
    queryKey: ["partners"],
    queryFn: fetchPartners,
    enabled: exploreTab === "parceiros",
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
    refetchInterval: 60_000,
    // Ao ENTRAR na aba Explorar, força buscar os amigos ao vivo na hora
    // (antes só atualizava a cada 60s ou ao clicar em "Atualizar agora").
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
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border bg-card p-3">
              <Search size={18} className="text-muted-foreground" />
              <input placeholder={t("explore.placeholder")} className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
            </div>

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
      {mounted ? (
        <Suspense fallback={<div className="mx-5 mb-5 h-40 rounded-2xl bg-gradient-sky shadow-card" />}>
          <MapView
            selectedFriendId={selectedFriendId}
            onSelectedFriendUnavailable={() => {
              // O amigo selecionado deixou de estar ao vivo (Req 4.4): avisa o
              // usuário e limpa a seleção.
              toast(t("liveFriends.unavailable"));
              setSelectedFriendId(null);
            }}
          />
        </Suspense>
      ) : (
        <div className="mx-5 mb-5 h-40 rounded-2xl bg-gradient-sky shadow-card" />
      )}

      {/* Lista de amigos em atividade ao vivo, logo abaixo do mapa (Req 3.1).
          `is_live` já é filtrado aqui; a exclusão do próprio usuário vem de
          `fetchLiveActivityFriends`. */}
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
              className="overflow-hidden rounded-2xl bg-card shadow-card transition-base active:scale-[0.98]"
            >
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
