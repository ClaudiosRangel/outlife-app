import { useState } from "react";
import { MapContainer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import type { MapLayerKey } from "@/lib/map-config";
import { MapLayerControl, MapTileLayer } from "@/components/map-layers";

const icon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export default function PartnerLocationMap({
  lat,
  lng,
  name,
  location,
}: {
  lat: number;
  lng: number;
  name: string;
  location?: string;
}) {
  const [layer, setLayer] = useState<MapLayerKey>("outdoors");
  return (
    <div className="relative isolate overflow-hidden rounded-2xl" style={{ height: 220 }}>
      <MapLayerControl layer={layer} onChange={setLayer} />
      <MapContainer
        center={[lat, lng]}
        zoom={14}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <MapTileLayer layer={layer} />
        <Marker position={[lat, lng]} icon={icon}>
          <Popup>
            <div className="text-xs">
              <div className="font-semibold">{name}</div>
              {location && <div className="text-muted-foreground">{location}</div>}
            </div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
