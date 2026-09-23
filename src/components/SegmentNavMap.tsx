import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { getMapboxToken, MAPBOX_TILES_STYLE } from "@/lib/map-config";

const defaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export type LatLng = { lat: number; lng: number };

/**
 * Mapa de navegação "me leve até lá" (item 2) DENTRO do app: desenha o
 * trajeto do segmento numa cor destacada (laranja), a posição do usuário ao
 * vivo (bolinha azul) e uma linha tracejada do usuário até o INÍCIO do
 * segmento. Leaflet + tiles Mapbox (confiável no WebView).
 */
export default function SegmentNavMap({
  polyline,
  start,
  user,
  height = 380,
}: {
  /** [lng, lat][] do segmento (como no banco). */
  polyline?: [number, number][] | null;
  start: LatLng | null;
  user: LatLng | null;
  height?: number;
}) {
  const segLine: [number, number][] =
    polyline && polyline.length >= 2 ? polyline.map(([lng, lat]) => [lat, lng]) : [];
  const center: [number, number] = user
    ? [user.lat, user.lng]
    : start
      ? [start.lat, start.lng]
      : segLine[0] ?? [-15.7801, -47.9292];

  return (
    <div className="relative isolate overflow-hidden rounded-2xl shadow-card" style={{ height }}>
      <MapContainer center={center} zoom={15} style={{ height: "100%", width: "100%" }}>
        <TileLayerAuto />
        {/* Trajeto do segmento em destaque (laranja). */}
        {segLine.length >= 2 && (
          <Polyline positions={segLine} pathOptions={{ color: "#f97316", weight: 6, opacity: 0.9 }} />
        )}
        {/* Linha guia do usuário até o início (tracejada verde). */}
        {user && start && (
          <Polyline
            positions={[[user.lat, user.lng], [start.lat, start.lng]]}
            pathOptions={{ color: "#16a34a", weight: 3, dashArray: "6 8" }}
          />
        )}
        {start && <Marker position={[start.lat, start.lng]} icon={defaultIcon} />}
        {user && (
          <CircleMarker
            center={[user.lat, user.lng]}
            radius={8}
            pathOptions={{ color: "#1d4ed8", fillColor: "#3b82f6", fillOpacity: 1, weight: 3 }}
          />
        )}
        <FollowUser user={user} />
      </MapContainer>
    </div>
  );
}

function TileLayerAuto() {
  const token = getMapboxToken();
  if (token) {
    return (
      <TileLayer
        attribution="&copy; Mapbox &copy; OpenStreetMap"
        tileSize={512}
        zoomOffset={-1}
        url={`https://api.mapbox.com/styles/v1/mapbox/${MAPBOX_TILES_STYLE}/tiles/{z}/{x}/{y}?access_token=${token}`}
      />
    );
  }
  return <TileLayer attribution="&copy; OpenStreetMap" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />;
}

// Recentraliza no usuário conforme ele se move.
function FollowUser({ user }: { user: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (user) map.panTo([user.lat, user.lng]);
  }, [user, map]);
  return null;
}
