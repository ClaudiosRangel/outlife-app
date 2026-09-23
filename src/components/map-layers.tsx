import { TileLayer } from "react-leaflet";
import { Layers } from "lucide-react";
import { getMapboxToken, MAP_LAYERS, type MapLayerKey } from "@/lib/map-config";

/**
 * Seletor flutuante de camada de mapa (relevo/satélite/ruas), padronizado a
 * partir do Explorar/ActivityMap (item 2). Só aparece quando há token Mapbox
 * (as camadas dependem dos estilos raster do Mapbox). Deve ser renderizado
 * como irmão do <MapContainer>, dentro do wrapper `relative`.
 */
export function MapLayerControl({
  layer,
  onChange,
}: {
  layer: MapLayerKey;
  onChange: (l: MapLayerKey) => void;
}) {
  if (!getMapboxToken()) return null;
  return (
    <div className="absolute right-2 top-2 z-[1000] flex gap-1 rounded-full bg-white/90 p-1 shadow-md backdrop-blur">
      {MAP_LAYERS.map((l) => (
        <button
          key={l.key}
          type="button"
          onClick={() => onChange(l.key)}
          aria-label={l.key}
          className={`grid h-7 w-7 place-items-center rounded-full text-[10px] font-semibold transition-base ${
            layer === l.key ? "bg-primary text-primary-foreground" : "text-gray-700"
          }`}
        >
          {l.key === "outdoors" ? <Layers size={13} /> : l.key === "satellite" ? "🛰" : "🗺"}
        </button>
      ))}
    </div>
  );
}

/**
 * TileLayer padronizado: usa tiles Mapbox (estilo da camada escolhida) quando
 * há token; senão cai para OpenStreetMap. Deve ficar DENTRO do <MapContainer>.
 * O `key={layer}` força o remonte do tile ao trocar de camada.
 */
export function MapTileLayer({ layer }: { layer: MapLayerKey }) {
  const token = getMapboxToken();
  if (token) {
    const style = MAP_LAYERS.find((l) => l.key === layer)?.style ?? "outdoors-v12";
    return (
      <TileLayer
        key={layer}
        attribution="&copy; Mapbox &copy; OpenStreetMap"
        tileSize={512}
        zoomOffset={-1}
        url={`https://api.mapbox.com/styles/v1/mapbox/${style}/tiles/{z}/{x}/{y}?access_token=${token}`}
      />
    );
  }
  return <TileLayer attribution="&copy; OpenStreetMap" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />;
}
