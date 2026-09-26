// Mapa estático do traçado de um destino (Bloco 3). Leaflet + tiles (satélite/
// relevo via MapTileLayer), Polyline laranja com halo, marcador de início/fim.
// Sem WebGL (confiável no WebView).

import { useState } from "react";
import { MapContainer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { useEffect } from "react";
import type { MapLayerKey } from "@/lib/map-config";
import { MapTileLayer, MapLayerControl } from "@/components/map-layers";

const startIcon = L.icon({
  iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow,
  iconSize: [25, 41], iconAnchor: [12, 41],
});

type LatLng = { lat: number; lng: number };

function FitBounds({ path }: { path: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (path.length >= 2) {
      const b = L.latLngBounds(path.map((p) => [p.lat, p.lng] as [number, number]));
      map.fitBounds(b, { padding: [30, 30] });
    }
  }, [path, map]);
  return null;
}

export default function DestinationRouteMap({ path, height = 240 }: { path: LatLng[]; height?: number }) {
  const [layer, setLayer] = useState<MapLayerKey>("outdoors");
  if (path.length < 2) return null;
  const center: [number, number] = [path[0].lat, path[0].lng];
  const line = path.map((p) => [p.lat, p.lng]) as [number, number][];
  const end = path[path.length - 1];

  return (
    <div className="relative overflow-hidden rounded-2xl shadow-card" style={{ height }}>
      <MapContainer center={center} zoom={15} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false} zoomControl={false} attributionControl={false}>
        <MapTileLayer layer={layer} />
        <Polyline positions={line} pathOptions={{ color: "#000000", weight: 8, opacity: 0.35 }} />
        <Polyline positions={line} pathOptions={{ color: "#f97316", weight: 5, opacity: 0.95 }} />
        <Marker position={[path[0].lat, path[0].lng]} icon={startIcon} />
        <Marker position={[end.lat, end.lng]} icon={startIcon} />
        <FitBounds path={path} />
      </MapContainer>
      <MapLayerControl layer={layer} onChange={setLayer} />
    </div>
  );
}
