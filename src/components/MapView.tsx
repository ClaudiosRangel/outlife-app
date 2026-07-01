import { useRef } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { fetchDestinationsRaw, fetchSharedUserLocations, fetchMyProfile, resolveAsset } from "@/lib/api";
import { Locate, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";

const BRAZIL_CENTER: [number, number] = [-15.7801, -47.9292];
const BRAZIL_ZOOM = 4;

const defaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function avatarDivIcon(url: string | null, name: string): L.DivIcon {
  const src = url ? resolveAsset(url) : "";
  const inner = src
    ? `<img src="${src}" alt="${name}" style="width:100%;height:100%;object-fit:cover;border-radius:9999px"/>`
    : `<div style="width:100%;height:100%;display:grid;place-items:center;background:#16a34a;color:white;font-weight:600;border-radius:9999px;font-size:14px">${(name?.[0] ?? "?").toUpperCase()}</div>`;
  return L.divIcon({
    className: "outlife-user-marker",
    html: `<div style="width:36px;height:36px;border-radius:9999px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.25);overflow:hidden;background:#fff">${inner}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
}

export default function MapView() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const mapRef = useRef<L.Map | null>(null);

  const { data: destinations = [] } = useQuery({
    queryKey: ["destinations-raw"],
    queryFn: fetchDestinationsRaw,
  });

  const { data: shared = [] } = useQuery({
    queryKey: ["shared-locations"],
    queryFn: fetchSharedUserLocations,
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
    myProfile?.location_sharing_mode && myProfile.location_sharing_mode !== "none" && myLat != null && myLng != null;

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
      <div className="mx-5 mb-2 h-40 overflow-hidden rounded-2xl shadow-card bg-gradient-sky">
        <MapContainer
          center={BRAZIL_CENTER}
          zoom={BRAZIL_ZOOM}
          scrollWheelZoom={false}
          style={{ height: "100%", width: "100%" }}
          ref={(m) => {
            mapRef.current = m;
          }}
        >
          <TileLayer attribution="&copy; OpenStreetMap" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {markers.map((d) => (
            <Marker key={d.id} position={[Number(d.latitude), Number(d.longitude)]} icon={defaultIcon}>
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
          {shared.map((u) => (
            <Marker
              key={u.id}
              position={[u.latitude, u.longitude]}
              icon={avatarDivIcon(u.avatar_url, u.full_name ?? u.username ?? "?")}
            >
              <Popup>
                <div className="text-xs">
                  <div className="font-semibold">{u.full_name ?? u.username ?? "Aventureiro"}</div>
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
          ))}
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
