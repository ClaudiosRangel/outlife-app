import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from "react-leaflet";
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
 * Mapa para desenhar um segmento marcando início e fim com toques (spec
 * segmentos — criar pelo mapa). 1º toque define o início; 2º o fim; toques
 * seguintes redefinem (limpa e começa de novo). Usa Leaflet + tiles Mapbox
 * (confiável no WebView).
 */
export default function SegmentDrawMap({
  start,
  end,
  center,
  onChange,
  height = 340,
}: {
  start: LatLng | null;
  end: LatLng | null;
  center: LatLng | null;
  onChange: (next: { start: LatLng | null; end: LatLng | null }) => void;
  height?: number;
}) {
  const initialCenter: [number, number] = center
    ? [center.lat, center.lng]
    : start
      ? [start.lat, start.lng]
      : [-15.7801, -47.9292];
  const initialZoom = center || start ? 14 : 4;

  return (
    <div className="relative isolate overflow-hidden rounded-2xl shadow-card" style={{ height }}>
      <MapContainer center={initialCenter} zoom={initialZoom} style={{ height: "100%", width: "100%" }}>
        <TileLayerAuto />
        <ClickCapture start={start} end={end} onChange={onChange} />
        {start && <Marker position={[start.lat, start.lng]} icon={defaultIcon} />}
        {end && <Marker position={[end.lat, end.lng]} icon={defaultIcon} />}
        {start && end && (
          <Polyline positions={[[start.lat, start.lng], [end.lat, end.lng]]} pathOptions={{ color: "#16a34a", weight: 4 }} />
        )}
        <RecenterOnce center={center} />
      </MapContainer>
    </div>
  );
}

function TileLayerAuto() {
  const token = getMapboxToken();
  if (token) {
    return (
      <TileLayer
        attribution='&copy; Mapbox &copy; OpenStreetMap'
        tileSize={512}
        zoomOffset={-1}
        url={`https://api.mapbox.com/styles/v1/mapbox/${MAPBOX_TILES_STYLE}/tiles/{z}/{x}/{y}?access_token=${token}`}
      />
    );
  }
  return <TileLayer attribution="&copy; OpenStreetMap" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />;
}

function ClickCapture({
  start,
  end,
  onChange,
}: {
  start: LatLng | null;
  end: LatLng | null;
  onChange: (next: { start: LatLng | null; end: LatLng | null }) => void;
}) {
  useMapEvents({
    click(e) {
      const p = { lat: e.latlng.lat, lng: e.latlng.lng };
      if (!start || (start && end)) {
        // Sem início, ou já tinha os dois → recomeça definindo o início.
        onChange({ start: p, end: null });
      } else {
        // Tinha só o início → define o fim.
        onChange({ start, end: p });
      }
    },
  });
  return null;
}

function RecenterOnce({ center }: { center: LatLng | null }) {
  const map = useMapEvents({});
  const doneRef = useRef(false);
  useEffect(() => {
    if (center && !doneRef.current) {
      map.setView([center.lat, center.lng], 14);
      doneRef.current = true;
    }
  }, [center, map]);
  return null;
}
