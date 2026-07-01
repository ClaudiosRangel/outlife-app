import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Polyline, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const defaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export type LatLng = { lat: number; lng: number };

type Props = {
  /** Array de pontos [lat,lng] do trajeto */
  path: LatLng[];
  /** Posição "atual" (modo live) */
  current?: LatLng | null;
  /** Mostra início/fim (modo histórico) */
  showStartEnd?: boolean;
  /** Se true (modo live), recentraliza no ponto atual */
  follow?: boolean;
  height?: number | string;
};

function Recenter({ pos, follow }: { pos: LatLng | null | undefined; follow: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (follow && pos) map.setView([pos.lat, pos.lng], Math.max(map.getZoom(), 16), { animate: true });
  }, [pos?.lat, pos?.lng, follow, map]);
  return null;
}

function FitBounds({ path }: { path: LatLng[] }) {
  const map = useMap();
  const fittedRef = useRef(false);
  useEffect(() => {
    if (fittedRef.current || path.length < 2) return;
    const bounds = L.latLngBounds(path.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [24, 24] });
    fittedRef.current = true;
  }, [path, map]);
  return null;
}

export default function ActivityMap({
  path,
  current,
  showStartEnd = false,
  follow = false,
  height = 300,
}: Props) {
  const positions = useMemo(
    () => path.map((p) => [p.lat, p.lng] as [number, number]),
    [path],
  );
  const initialCenter: [number, number] = current
    ? [current.lat, current.lng]
    : positions[0] ?? [-15.78, -47.93];

  return (
    <div className="overflow-hidden rounded-2xl shadow-card" style={{ height }}>
      <MapContainer
        center={initialCenter}
        zoom={15}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap"
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {positions.length >= 2 && (
          <Polyline positions={positions} pathOptions={{ color: "#16a34a", weight: 5, opacity: 0.85 }} />
        )}
        {current && <Marker position={[current.lat, current.lng]} icon={defaultIcon} />}
        {showStartEnd && positions.length >= 2 && (
          <>
            <Marker position={positions[0]} icon={defaultIcon} />
            <Marker position={positions[positions.length - 1]} icon={defaultIcon} />
          </>
        )}
        {follow && <Recenter pos={current ?? null} follow={follow} />}
        {!follow && <FitBounds path={path} />}
      </MapContainer>
    </div>
  );
}
