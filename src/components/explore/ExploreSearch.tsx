import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, MapPin, Users, Store, CalendarDays, Loader2, Mountain, Footprints } from "lucide-react";
import { searchUsers, resolveAsset, type Partner } from "@/lib/api";
import type { NearbyEvent } from "@/lib/api";
import { geocodePlace } from "@/lib/geocode";
import avatarFallback from "@/assets/avatar-rafael.jpg";

export type ExploreSearchResult =
  | { kind: "region"; label: string; lat: number; lng: number }
  | { kind: "friend"; label: string; userId: string; avatarUrl: string | null }
  | { kind: "partner"; label: string; partnerId: string }
  | { kind: "event"; label: string; eventId: string }
  | { kind: "destination"; label: string; destinationId: string }
  | { kind: "trail"; label: string; trailId: string };

/** Item leve de destino/trilha para a busca (id + nome + região). */
export type SearchPlace = { id: string; name: string; region?: string | null };

/**
 * Busca unificada do Explorar (spec 3.2): cidades (geocode Mapbox) + amigos
 * (searchUsers) + parceiros + eventos (filtrados localmente). Mostra sugestões
 * agrupadas conforme digita (debounce). Parceiros/eventos vêm das listas já
 * carregadas no Explorar (sem custo extra).
 */
export function ExploreSearch({
  partners,
  events,
  destinations = [],
  trails = [],
  onPick,
  placeholder,
}: {
  partners: Partner[];
  events: NearbyEvent[];
  destinations?: SearchPlace[];
  trails?: SearchPlace[];
  onPick: (r: ExploreSearchResult) => void;
  placeholder?: string;
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loadingRegion, setLoadingRegion] = useState(false);
  const [friends, setFriends] = useState<ExploreSearchResult[]>([]);
  const [region, setRegion] = useState<ExploreSearchResult | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Debounce da busca (amigos via API + cidade via geocode).
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setFriends([]);
      setRegion(null);
      return;
    }
    let cancelled = false;
    setLoadingRegion(true);
    const timer = setTimeout(async () => {
      try {
        const [users, geo] = await Promise.all([
          searchUsers(term).catch(() => []),
          geocodePlace(term).catch(() => null),
        ]);
        if (cancelled) return;
        setFriends(
          users.slice(0, 4).map((u) => ({
            kind: "friend" as const,
            label: u.full_name ?? u.username ?? "Aventureiro",
            userId: u.id,
            avatarUrl: u.avatar_url,
          })),
        );
        setRegion(geo ? { kind: "region", label: geo.name, lat: geo.lat, lng: geo.lng } : null);
      } finally {
        if (!cancelled) setLoadingRegion(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q]);

  const term = q.trim().toLowerCase();
  const partnerMatches: ExploreSearchResult[] =
    term.length >= 2
      ? partners
          .filter((p) => p.name.toLowerCase().includes(term) || p.category.toLowerCase().includes(term))
          .slice(0, 4)
          .map((p) => ({ kind: "partner", label: p.name, partnerId: p.id }))
      : [];
  const eventMatches: ExploreSearchResult[] =
    term.length >= 2
      ? events
          .filter((e) => e.title.toLowerCase().includes(term) || (e.city ?? "").toLowerCase().includes(term))
          .slice(0, 4)
          .map((e) => ({ kind: "event", label: e.title, eventId: e.id }))
      : [];
  const destinationMatches: ExploreSearchResult[] =
    term.length >= 2
      ? destinations
          .filter((d) => d.name.toLowerCase().includes(term) || (d.region ?? "").toLowerCase().includes(term))
          .slice(0, 5)
          .map((d) => ({ kind: "destination", label: d.name, destinationId: d.id }))
      : [];
  const trailMatches: ExploreSearchResult[] =
    term.length >= 2
      ? trails
          .filter((tr) => tr.name.toLowerCase().includes(term) || (tr.region ?? "").toLowerCase().includes(term))
          .slice(0, 5)
          .map((tr) => ({ kind: "trail", label: tr.name, trailId: tr.id }))
      : [];

  const hasResults =
    region ||
    friends.length ||
    partnerMatches.length ||
    eventMatches.length ||
    destinationMatches.length ||
    trailMatches.length;

  const pick = (r: ExploreSearchResult) => {
    setOpen(false);
    setQ(r.kind === "region" ? r.label : "");
    onPick(r);
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <Search size={18} className="text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          inputMode="search"
        />
        {loadingRegion && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
      </div>

      {open && term.length >= 2 && (
        <div className="absolute z-[80] mt-1 max-h-80 w-full overflow-y-auto rounded-2xl border border-border bg-card p-1 shadow-xl">
          {!hasResults && !loadingRegion && (
            <div className="p-3 text-center text-xs text-muted-foreground">
              {t("explore.search.empty", "Nada encontrado.")}
            </div>
          )}

          {region && (
            <Group label={t("explore.search.cities", "Cidades")}>
              <Row icon={<MapPin size={14} className="text-primary" />} label={region.label} onClick={() => pick(region)} />
            </Group>
          )}
          {friends.length > 0 && (
            <Group label={t("explore.search.friends", "Pessoas")}>
              {friends.map((f) =>
                f.kind === "friend" ? (
                  <Row
                    key={f.userId}
                    icon={<img src={resolveAsset(f.avatarUrl, avatarFallback)} alt="" className="h-6 w-6 rounded-full object-cover" />}
                    label={f.label}
                    onClick={() => pick(f)}
                  />
                ) : null,
              )}
            </Group>
          )}
          {partnerMatches.length > 0 && (
            <Group label={t("explore.search.partners", "Parceiros")}>
              {partnerMatches.map((p) =>
                p.kind === "partner" ? (
                  <Row key={p.partnerId} icon={<Store size={14} className="text-primary" />} label={p.label} onClick={() => pick(p)} />
                ) : null,
              )}
            </Group>
          )}
          {eventMatches.length > 0 && (
            <Group label={t("explore.search.events", "Eventos")}>
              {eventMatches.map((e) =>
                e.kind === "event" ? (
                  <Row key={e.eventId} icon={<CalendarDays size={14} className="text-primary" />} label={e.label} onClick={() => pick(e)} />
                ) : null,
              )}
            </Group>
          )}
          {destinationMatches.length > 0 && (
            <Group label={t("explore.search.destinations", "Destinos")}>
              {destinationMatches.map((d) =>
                d.kind === "destination" ? (
                  <Row key={d.destinationId} icon={<Mountain size={14} className="text-primary" />} label={d.label} onClick={() => pick(d)} />
                ) : null,
              )}
            </Group>
          )}
          {trailMatches.length > 0 && (
            <Group label={t("explore.search.trails", "Trilhas")}>
              {trailMatches.map((tr) =>
                tr.kind === "trail" ? (
                  <Row key={tr.trailId} icon={<Footprints size={14} className="text-primary" />} label={tr.label} onClick={() => pick(tr)} />
                ) : null,
              )}
            </Group>
          )}
        </div>
      )}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function Row({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm hover:bg-secondary/60 active:scale-[0.99]"
    >
      <span className="grid h-6 w-6 shrink-0 place-items-center">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}
