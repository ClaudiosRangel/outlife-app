import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Search, MapPin, X, Navigation } from "lucide-react";
import { StatusBar } from "@/components/StatusBar";
import {
  fetchPartners,
  fetchDestinations,
  fetchCommunityPosts,
  findSimilarDestinations,
  resolveAsset,
} from "@/lib/api";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/busca")({
  component: Busca,
  head: () => ({
    meta: [
      { title: "Buscar — Outlife" },
      { name: "description", content: "Busque destinos, parceiros e experiências outdoor no Outlife." },
      { property: "og:title", content: "Buscar — Outlife" },
      { property: "og:description", content: "Busque destinos, parceiros e experiências outdoor." },
      { property: "og:url", content: "/busca" },
    ],
    links: [{ rel: "canonical", href: "/busca" }],
  }),
});

/** Distância simples em km (Haversine simplificado para ordenação relativa) */
function haversineDist(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function Busca() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(searchQuery.trim()), 300);
    return () => clearTimeout(id);
  }, [searchQuery]);

  // Obter localização do usuário para ordenar por proximidade
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, timeout: 5000 },
    );
  }, []);

  const { data: partners = [] } = useQuery({ queryKey: ["partners"], queryFn: fetchPartners });
  const { data: destinations = [] } = useQuery({ queryKey: ["destinations"], queryFn: fetchDestinations });
  const { data: posts = [] } = useQuery({ queryKey: ["community-posts"], queryFn: fetchCommunityPosts });

  // Amigos com atividade em andamento ou compartilhando localização
  const { data: activeTrackers = [] } = useQuery({
    queryKey: ["active-trackers", user?.id],
    queryFn: async () => {
      if (!user) return [];
      // Busca IDs dos amigos aceitos
      const { data: friendships } = await supabase
        .from("user_friends")
        .select("requester_id, addressee_id")
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .eq("status", "accepted");

      const friendIds = (friendships ?? []).map((f: any) =>
        f.requester_id === user.id ? f.addressee_id : f.requester_id
      );

      if (friendIds.length === 0) return [];

      // Busca atividades em andamento dos amigos
      const { data, error } = await supabase
        .from("user_activities" as never)
        .select("id, user_id, distance_meters, route_geojson, start_time, activity_type")
        .eq("status", "in_progress")
        .in("user_id", friendIds)
        .order("start_time", { ascending: false })
        .limit(20);
      if (error) return [];

      // Busca perfis dos amigos encontrados
      const userIds = [...new Set((data ?? []).map((a: any) => a.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url")
        .in("id", userIds);

      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

      return (data ?? []).map((a: any) => ({
        ...a,
        profiles: profileMap.get(a.user_id) ?? null,
      })) as Array<{
        id: string;
        user_id: string;
        distance_meters: number | null;
        route_geojson: { coordinates: number[][] } | null;
        start_time: string;
        activity_type: string | null;
        profiles: { full_name: string | null; username: string | null; avatar_url: string | null } | null;
      }>;
    },
    enabled: !!user,
    refetchInterval: 30_000,
  });

  // Busca por similaridade (server-side) — combina nome + proximidade
  const { data: similarDestinations = [] } = useQuery({
    queryKey: ["similar-destinations", debounced],
    queryFn: () => findSimilarDestinations(debounced),
    enabled: debounced.length >= 2,
  });

  const { foundPartners, foundDestinations, foundPosts } = useMemo(() => {
    const q = debounced.toLowerCase();
    if (!q) return { foundPartners: [], foundDestinations: [], foundPosts: [] };

    // Mescla destinos locais (com img) com sugestões de similaridade do servidor
    const similarIds = new Set(similarDestinations.map((d) => d.id));
    const localMatches = destinations.filter(
      (d) => d.name.toLowerCase().includes(q) || d.region.toLowerCase().includes(q),
    );
    const localIds = new Set(localMatches.map((d) => d.id));
    const extraFromSimilar = similarDestinations
      .filter((d) => !localIds.has(d.id))
      .map((d) => ({
        id: d.id,
        name: d.name,
        region: d.region ?? d.state ?? "",
        img: resolveAsset(d.main_image_url),
      }));

    return {
      foundPartners: partners.filter(
        (p) => p.name.toLowerCase().includes(q) || p.location.toLowerCase().includes(q),
      ),
      foundDestinations: [
        ...localMatches.map((d) => ({ id: d.id, name: d.name, region: d.region, img: d.img, similar: similarIds.has(d.id) })),
        ...extraFromSimilar.map((d) => ({ ...d, similar: true })),
      ],
      foundPosts: (posts as any[]).filter((c) => {
        const text = (c.text ?? "").toLowerCase();
        const place = (c.place ?? "").toLowerCase();
        const author = (c.author?.full_name ?? c.author?.username ?? "").toLowerCase();
        return text.includes(q) || place.includes(q) || author.includes(q);
      }),
    };
  }, [debounced, partners, destinations, posts, similarDestinations]);

  const totalResults = foundPartners.length + foundDestinations.length + foundPosts.length;

  // Parceiros ordenados por proximidade (quando temos localização do usuário)
  const nearbyPartners = useMemo(() => {
    if (!userLocation) return partners.slice(0, 10);
    return [...partners]
      .filter((p) => p.coords)
      .map((p) => ({
        ...p,
        distKm: haversineDist(userLocation, p.coords!),
      }))
      .sort((a, b) => a.distKm - b.distKm)
      .slice(0, 10);
  }, [partners, userLocation]);

  return (
    <div className="animate-float-up pb-24">
      <StatusBar />

      <div className="px-5 pt-2 flex items-center justify-between">
        <Link to="/" className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card">
          <ChevronLeft size={18} />
        </Link>
        <span className="text-xs font-medium text-muted-foreground">{t("search.title")}</span>
        <span className="w-10" />
      </div>

      <div className="px-5 mt-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("search.placeholder")}
            className="h-12 w-full rounded-2xl border border-border bg-card pl-10 pr-10 text-sm outline-none focus:ring-1 ring-ring"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X size={16} className="text-muted-foreground" />
            </button>
          )}
        </div>
        {searchQuery && (
          <p className="mt-3 text-xs text-muted-foreground">{totalResults} {t("search.results")}</p>
        )}
      </div>

      {!searchQuery && (
        <div className="mt-6 space-y-6">
          {/* Pessoas com atividade em andamento */}
          {activeTrackers.length > 0 && (
            <section className="px-5">
              <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                <Navigation size={16} className="text-green-500" />
                {t("search.activeNow")}
              </h2>
              <div className="mt-3 space-y-2">
                {activeTrackers.map((a) => {
                  const lastCoord = a.route_geojson?.coordinates?.at(-1);
                  return (
                    <div key={a.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card">
                      <div className="relative">
                        <img
                          src={resolveAsset(a.profiles?.avatar_url)}
                          alt={a.profiles?.full_name ?? ""}
                          className="h-12 w-12 rounded-full object-cover"
                        />
                        <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-green-500 ring-2 ring-card" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-sm">
                          {a.profiles?.full_name ?? a.profiles?.username ?? "Aventureiro"}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="capitalize">{a.activity_type ?? "atividade"}</span>
                          {a.distance_meters != null && a.distance_meters > 0 && (
                            <span>• {(a.distance_meters / 1000).toFixed(1)} km</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Parceiros próximos */}
          {nearbyPartners.length > 0 && (
            <section className="px-5">
              <h2 className="font-display text-lg font-semibold">
                {t("search.nearbyPartners")}
              </h2>
              <div className="mt-3 space-y-2">
                {nearbyPartners.map((p) => (
                  <Link
                    key={p.id}
                    to="/parceiro/$partnerId"
                    params={{ partnerId: p.id }}
                    className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card"
                  >
                    <img src={p.img} alt={p.name} loading="lazy" className="h-14 w-14 rounded-xl object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-sm">{p.name}</div>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <MapPin size={10} /> {p.location}
                        {"distKm" in p && (
                          <span className="ml-1">• {(p as any).distKm.toFixed(1)} km</span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {nearbyPartners.length === 0 && activeTrackers.length === 0 && (
            <div className="px-5 mt-10 text-center text-muted-foreground">
              <Search size={32} className="mx-auto opacity-40" />
              <p className="mt-3 text-sm">{t("search.startTyping")}</p>
            </div>
          )}
        </div>
      )}


      {searchQuery && (
        <div className="mt-6 space-y-6">
          {foundPartners.length > 0 && (
            <section className="px-5">
              <h2 className="font-display text-lg font-semibold">{t("search.sectionPartners")}</h2>
              <div className="mt-3 space-y-2">
                {foundPartners.map((p) => (
                  <Link
                    key={p.id}
                    to="/parceiro/$partnerId"
                    params={{ partnerId: p.id }}
                    className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card"
                  >
                    <img src={p.img} alt={p.name} loading="lazy" className="h-14 w-14 rounded-xl object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-sm">{p.name}</div>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <MapPin size={10} /> {p.location}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {foundDestinations.length > 0 && (
            <section className="px-5">
              <h2 className="font-display text-lg font-semibold">{t("search.sectionDestinations")}</h2>
              <div className="mt-3 space-y-2">
                {foundDestinations.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card">
                    <img src={d.img} alt={d.name} loading="lazy" className="h-14 w-14 rounded-xl object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-sm">{d.name}</div>
                      <div className="text-[11px] text-muted-foreground">{d.region}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {foundPosts.length > 0 && (
            <section className="px-5">
              <h2 className="font-display text-lg font-semibold">{t("search.sectionPosts")}</h2>
              <div className="mt-3 space-y-2">
                {foundPosts.map((c: any) => (
                  <div key={c.id} className="flex items-start gap-3 rounded-2xl bg-card p-3 shadow-card">
                    <img
                      src={resolveAsset(c.author?.avatar_url)}
                      alt={c.author?.full_name ?? "autor"}
                      loading="lazy"
                      className="h-10 w-10 rounded-full object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">
                        {c.author?.full_name ?? c.author?.username ?? "Aventureiro"}
                      </div>
                      <div className="line-clamp-2 text-[12px] text-muted-foreground">{c.text}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {totalResults === 0 && (
            <div className="px-5 mt-4 text-center text-sm text-muted-foreground">
              {t("search.noResults")}
            </div>
          )}

        </div>
      )}
    </div>
  );
}
