import { useEffect, useState } from "react";
import { MapContainer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import type { MapLayerKey } from "@/lib/map-config";
import { MapLayerControl, MapTileLayer } from "@/components/map-layers";

const defaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export type LatLng = { lat: number; lng: number };

/**
 * Mapa read-only para exibir o trecho de um segmento (item 3): desenha a
 * polilinha início→fim com marcadores nas pontas e enquadra tudo na tela.
 * Usa Leaflet + tiles Mapbox (confiável no WebView).
 */
export default function SegmentViewMap({
  start,
  end,
  polyline,
  height = 260,
}: {
  start: LatLng | null;
  end: LatLng | null;
  /** [lng, lat][] como guardado no banco. */
  polyline?: [number, number][] | null;
  height?: number;
}) {
  const line: [number, number][] =
    polyline && polyline.length >= 2
      ? polyline.map(([lng, lat]) => [lat, lng])
      : start && end
        ? [[start.lat, start.lng], [end.lat, end.lng]]
        : [];

  const center: [number, number] = line.length > 0 ? line[0] : [-15.7801, -47.9292];
  const [layer, setLayer] = useState<MapLayerKey>("outdoors");

  return (
    <div className="relative isolate overflow-hidden rounded-2xl shadow-card" style={{ height }}>
      <MapLayerControl layer={layer} onChange={setLayer} />
      <MapContainer center={center} zoom={14} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
        <MapTileLayer layer={layer} />
        {line.length >= 2 && (
          <Polyline positions={line} pathOptions={{ color: "#16a34a", weight: 5 }} />
        )}
        {start && <Marker position={[start.lat, start.lng]} icon={defaultIcon} />}
        {end && <Marker position={[end.lat, end.lng]} icon={defaultIcon} />}
        <FitBounds line={line} />
      </MapContainer>
    </div>
  );
}

function FitBounds({ line }: { line: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (line.length >= 2) {
      const bounds = L.latLngBounds(line.map(([lat, lng]) => L.latLng(lat, lng)));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    } else if (line.length === 1) {
      map.setView(line[0], 14);
    }
  }, [line, map]);
  return null;
}
