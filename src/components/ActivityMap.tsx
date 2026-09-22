import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Polyline, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { Layers } from "lucide-react";
import { getMapboxToken, MAP_LAYERS, type MapLayerKey } from "@/lib/map-config";

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

  // Camada de mapa configurável (relevo/satélite/ruas) — igual ao Explorar.
  const [layer, setLayer] = useState<MapLayerKey>("outdoors");
  const token = getMapboxToken();

  return (
    // `isolate` cria um novo contexto de empilhamento local: os
    // z-index internos do Leaflet (controles de zoom chegam a 1000,
    // panes a até 700) são altíssimos e, sem isolamento, "escapam" para o
    // contexto global — ficando por cima até de overlays renderizados
    // depois no DOM, como o Sheet de "Finalizar atividade" (bug relatado:
    // o mapa aparecia flutuando por cima do formulário e do fundo escuro).
    // `isolate` contém esses z-index dentro deste elemento, então o mapa
    // volta a respeitar a ordem normal de camadas da tela.
    <div className="relative isolate w-full overflow-hidden rounded-2xl shadow-card" style={{ height }}>
      {/* Seletor de camada (relevo/satélite/ruas) — só com tiles Mapbox. */}
      {token && (
        <div className="absolute right-2 top-2 z-[1000] flex gap-1 rounded-full bg-white/90 p-1 shadow-md backdrop-blur">
          {MAP_LAYERS.map((l) => (
            <button
              key={l.key}
              type="button"
              onClick={() => setLayer(l.key)}
              aria-label={l.key}
              className={`grid h-7 w-7 place-items-center rounded-full text-[10px] font-semibold transition-base ${
                layer === l.key ? "bg-primary text-primary-foreground" : "text-gray-700"
              }`}
            >
              {l.key === "outdoors" ? <Layers size={13} /> : l.key === "satellite" ? "🛰" : "🗺"}
            </button>
          ))}
        </div>
      )}
      <MapContainer
        center={initialCenter}
        zoom={15}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        {token ? (
          <TileLayer
            key={layer}
            attribution='&copy; Mapbox &copy; OpenStreetMap'
            tileSize={512}
            zoomOffset={-1}
            url={`https://api.mapbox.com/styles/v1/mapbox/${MAP_LAYERS.find((l) => l.key === layer)?.style ?? "outdoors-v12"}/tiles/{z}/{x}/{y}?access_token=${token}`}
          />
        ) : (
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}
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
