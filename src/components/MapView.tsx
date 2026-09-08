import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import {
  fetchDestinationsRaw,
  fetchLiveActivityFriends,
  fetchMyProfile,
  resolveAsset,
} from "@/lib/api";
import type { SharedLocation, LiveActivityFriend } from "@/lib/api";
import { deriveIsLive } from "@/lib/live-activity";
import { Locate, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";

const BRAZIL_CENTER: [number, number] = [-15.7801, -47.9292];
const BRAZIL_ZOOM = 4;

// Nível de zoom aproximado de rua usado ao centralizar num amigo selecionado
// na Live_Friends_List (Requirement 4.1).
const ZOOM_RUA = 16;

// A query ["shared-locations"] pode retornar tanto SharedLocation (estático)
// quanto o superset LiveActivityFriend (com activity_type + is_live) — o
// MapView deve funcionar com ambos (retrocompatibilidade). Este alias descreve
// esse tipo de linha "possivelmente ao vivo".
type MaybeLiveLocation = SharedLocation &
  Partial<Pick<LiveActivityFriend, "activity_type" | "is_live">>;

const defaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function avatarDivIcon(url: string | null, name: string, highlighted = false): L.DivIcon {
  const src = url ? resolveAsset(url) : "";
  const inner = src
    ? `<img src="${src}" alt="${name}" style="width:100%;height:100%;object-fit:cover;border-radius:9999px"/>`
    : `<div style="width:100%;height:100%;display:grid;place-items:center;background:#16a34a;color:white;font-weight:600;border-radius:9999px;font-size:14px">${(name?.[0] ?? "?").toUpperCase()}</div>`;
  // Marcador do amigo selecionado é destacado: maior, borda de acento e um
  // anel/sombra mais forte (Requirement 4.2).
  const size = highlighted ? 48 : 36;
  const border = highlighted ? "3px solid #16a34a" : "3px solid white";
  const shadow = highlighted
    ? "0 0 0 3px rgba(22,163,74,.35),0 4px 12px rgba(0,0,0,.35)"
    : "0 2px 8px rgba(0,0,0,.25)";
  const anchor = size / 2;
  return L.divIcon({
    className: highlighted
      ? "outlife-user-marker outlife-user-marker--selected"
      : "outlife-user-marker",
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;border:${border};box-shadow:${shadow};overflow:hidden;background:#fff">${inner}</div>`,
    iconSize: [size, size],
    iconAnchor: [anchor, anchor],
    popupAnchor: [0, -anchor],
  });
}

// Determina, de forma robusta, se uma linha da query está "ao vivo".
// Prioriza o `is_live` calculado pelo servidor na VIEW public_user_locations_live
// quando disponível; caso contrário deriva pela função pura deriveIsLive
// combinando o activity_type (proxy de atividade in_progress) com a recência da
// posição. Linhas do tipo SharedLocation puro (sem esses campos) nunca são
// consideradas "ao vivo".
function isRowLive(row: MaybeLiveLocation, nowMs: number): boolean {
  if (typeof row.is_live === "boolean") return row.is_live;
  if (!("activity_type" in row)) return false;
  const updatedMs = Date.parse(row.location_updated_at);
  return deriveIsLive({
    hasInProgressActivity: row.activity_type != null,
    locationUpdatedAtMs: Number.isNaN(updatedMs) ? null : updatedMs,
    nowMs,
  });
}

export interface MapViewProps {
  /**
   * id do amigo selecionado na Live_Friends_List. Ao mudar, o mapa centraliza
   * na posição ao vivo do amigo e destaca o marcador (Requirements 4.1/4.2/4.3).
   * Opcional — sem esta prop o MapView funciona como antes (retrocompatível).
   */
  selectedFriendId?: string | null;
  /**
   * Chamado quando a posição ao vivo do amigo selecionado deixa de estar
   * disponível: o amigo sumiu da lista OU deixou de estar "ao vivo"
   * (Requirement 4.4). Opcional.
   */
  onSelectedFriendUnavailable?: (friendId: string) => void;
}

export default function MapView({
  selectedFriendId,
  onSelectedFriendUnavailable,
}: MapViewProps = {}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const mapRef = useRef<L.Map | null>(null);

  const { data: destinations = [] } = useQuery({
    queryKey: ["destinations-raw"],
    queryFn: fetchDestinationsRaw,
  });

  // Fonte única de verdade para ["shared-locations"] (Req 6.3): a queryFn é
  // `fetchLiveActivityFriends` (VIEW superset public_user_locations_live), para
  // que o MapView e a LiveFriendsList compartilhem a MESMA key sem duas queryFn
  // divergentes. O MapView consome o superset via MaybeLiveLocation (is_live /
  // activity_type), preservando o comportamento estático quando esses campos
  // não vierem.
  const { data: shared = [] } = useQuery<MaybeLiveLocation[]>({
    queryKey: ["shared-locations"],
    queryFn: fetchLiveActivityFriends,
    refetchInterval: 60_000,
    enabled: !!user,
  });

  const { data: myProfile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: fetchMyProfile,
    enabled: !!user,
  });

  const myLat = myProfile?.latitude != null ? Number(myProfile.latitude) : null;
  const myLng = myProfile?.longitude != null ? Number(myProfile.longitude) : null;
  const sharingActive =
    myProfile?.location_sharing_mode &&
    myProfile.location_sharing_mode !== "none" &&
    myLat != null &&
    myLng != null;

  // Ao selecionar um amigo (mudança de selectedFriendId), centraliza o mapa na
  // posição ao vivo dele com zoom de rua (Req 4.1). O destaque do marcador é
  // aplicado na renderização (avatarDivIcon com highlighted), mais abaixo.
  useEffect(() => {
    if (!selectedFriendId) return;
    const friend = shared.find((u) => u.id === selectedFriendId);
    if (!friend) return;
    mapRef.current?.setView([friend.latitude, friend.longitude], ZOOM_RUA, { animate: true });
    // Depende só de selectedFriendId: a atualização de posição durante o
    // acompanhamento (Req 4.3) é feita pelo re-render do Marker, não por
    // re-centralizar o mapa a cada refetch (evita "puxar" o mapa do usuário).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFriendId]);

  // A cada atualização da query ["shared-locations"] (refetch periódico ou
  // invalidação), reavalia o amigo selecionado: se ele sumiu da lista ou
  // deixou de estar "ao vivo", avisa o consumidor para indicar indisponibilidade
  // (Req 4.4). Enquanto continua ao vivo, o Marker apenas re-renderiza na nova
  // posição (Req 4.3), sem ação aqui.
  useEffect(() => {
    if (!selectedFriendId || !onSelectedFriendUnavailable) return;
    const nowMs = Date.now();
    const friend = shared.find((u) => u.id === selectedFriendId);
    if (!friend || !isRowLive(friend, nowMs)) {
      onSelectedFriendUnavailable(selectedFriendId);
    }
  }, [shared, selectedFriendId, onSelectedFriendUnavailable]);

  const centerOnMe = () => {
    if (sharingActive && myLat != null && myLng != null) {
      mapRef.current?.setView([myLat, myLng], 13, { animate: true });
    } else {
      mapRef.current?.setView(BRAZIL_CENTER, BRAZIL_ZOOM, { animate: true });
    }
  };

  const markers = destinations.filter((d) => d.latitude != null && d.longitude != null);

  return (
    <>
      {/* `isolate` contém os z-index internos do Leaflet (controles de zoom
          chegam a 1000) dentro deste elemento, evitando que "escapem" e
          apareçam por cima de outros conteúdos da página (mesmo bug
          corrigido em ActivityMap.tsx). */}
      <div className="relative isolate mx-5 mb-2 h-40 overflow-hidden rounded-2xl shadow-card bg-gradient-sky">
        <MapContainer
          center={BRAZIL_CENTER}
          zoom={BRAZIL_ZOOM}
          scrollWheelZoom={false}
          style={{ height: "100%", width: "100%" }}
          ref={(m) => {
            mapRef.current = m;
          }}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {markers.map((d) => (
            <Marker
              key={d.id}
              position={[Number(d.latitude), Number(d.longitude)]}
              icon={defaultIcon}
            >
              <Popup>
                <div className="text-xs">
                  <div className="font-semibold">{d.name}</div>
                  <div className="text-muted-foreground">{d.region ?? d.state ?? ""}</div>
                  <Link to="/explorar" className="mt-1 inline-block font-semibold text-primary">
                    Ver detalhes →
                  </Link>
                </div>
              </Popup>
            </Marker>
          ))}
          {shared.map((u) => {
            const isSelected = selectedFriendId != null && u.id === selectedFriendId;
            return (
              <Marker
                key={u.id}
                position={[u.latitude, u.longitude]}
                icon={avatarDivIcon(u.avatar_url, u.full_name ?? u.username ?? "?", isSelected)}
                zIndexOffset={isSelected ? 1000 : 0}
              >
                <Popup>
                  <div className="text-xs">
                    <div className="font-semibold">
                      {u.full_name ?? u.username ?? "Aventureiro"}
                    </div>
                    {u.username && <div className="text-muted-foreground">@{u.username}</div>}
                    <Link
                      to="/parceiro/$partnerId"
                      params={{ partnerId: u.id }}
                      className="mt-1 inline-flex items-center gap-1 font-semibold text-primary"
                    >
                      <User size={11} /> {t("location.viewProfile")}
                    </Link>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
      <div className="mx-5 mb-5 flex justify-end">
        <button
          onClick={centerOnMe}
          className="inline-flex items-center gap-1.5 rounded-full bg-card border border-border px-3 py-1.5 text-[11px] font-medium shadow-card"
        >
          <Locate size={12} /> {sharingActive ? t("location.centerMe") : t("location.centerBrazil")}
        </button>
      </div>
    </>
  );
}
