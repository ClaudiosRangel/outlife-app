import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Locate, Box, Layers } from "lucide-react";
import { getMapboxToken, MAPBOX_STYLE, BRAZIL_CENTER, BRAZIL_ZOOM } from "@/lib/map-config";
import { resolveAsset } from "@/lib/api";
import type { NowMarker } from "@/lib/nearby";

/**
 * Mapa do Explorar com Mapbox GL (lazy). Estilo outdoor, toggle 2D/3D
 * (pitch + terreno), recentrar e marcadores da camada "agora". Em falha de
 * init, chama onError para o ExploreMap cair no fallback (Leaflet).
 */
export default function MapboxExploreMap({
  markers,
  center,
  onError,
  onMarkerClick,
}: {
  markers: NowMarker[];
  center: { lat: number; lng: number } | null;
  onError?: () => void;
  onMarkerClick?: (m: NowMarker) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const is3dRef = useRef(false);

  // Init do mapa (uma vez).
  useEffect(() => {
    const token = getMapboxToken();
    if (!token || !containerRef.current) {
      onError?.();
      return;
    }
    try {
      mapboxgl.accessToken = token;
      const start: [number, number] = center ? [center.lng, center.lat] : BRAZIL_CENTER;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: MAPBOX_STYLE,
        center: start,
        zoom: center ? 11 : BRAZIL_ZOOM,
        attributionControl: true,
      });
      map.on("error", (e) => {
        // Erros de tile/estilo não devem derrubar a tela; se o estilo não
        // carregar, cai no fallback.
        if (e?.error && (e.error as { status?: number }).status === 401) onError?.();
      });
      mapRef.current = map;
    } catch {
      onError?.();
    }
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Atualiza marcadores quando mudam.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    for (const mk of markers) {
      if (!Number.isFinite(mk.lat) || !Number.isFinite(mk.lng)) continue;
      const el = document.createElement("button");
      el.type = "button";
      el.setAttribute("aria-label", mk.title);
      el.className = "outvitar-map-pin";
      el.style.cssText =
        "width:34px;height:34px;border-radius:9999px;overflow:hidden;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3);background:#16a34a;cursor:pointer";
      if (mk.kind === "friend" && mk.avatarUrl) {
        const img = document.createElement("img");
        img.src = resolveAsset(mk.avatarUrl);
        img.style.cssText = "width:100%;height:100%;object-fit:cover";
        el.appendChild(img);
      } else {
        el.style.background = mk.kind === "event" ? "#f59e0b" : mk.kind === "partner" ? "#2563eb" : "#16a34a";
        el.textContent = mk.kind === "event" ? "★" : mk.kind === "partner" ? "◆" : "•";
        el.style.color = "#fff";
        el.style.display = "grid";
        el.style.placeItems = "center";
        el.style.fontSize = "14px";
      }
      el.addEventListener("click", () => onMarkerClick?.(mk));
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([mk.lng, mk.lat])
        .addTo(map);
      markersRef.current.push(marker);
    }
  }, [markers, onMarkerClick]);

  const toggle3d = () => {
    const map = mapRef.current;
    if (!map) return;
    is3dRef.current = !is3dRef.current;
    if (is3dRef.current) {
      // Terreno 3D + pitch.
      if (!map.getSource("mapbox-dem")) {
        map.addSource("mapbox-dem", {
          type: "raster-dem",
          url: "mapbox://mapbox.mapbox-terrain-dem-v1",
          tileSize: 512,
          maxzoom: 14,
        });
      }
      map.setTerrain({ source: "mapbox-dem", exaggeration: 1.4 });
      map.easeTo({ pitch: 60, duration: 600 });
    } else {
      map.setTerrain(null);
      map.easeTo({ pitch: 0, duration: 600 });
    }
  };

  const recenter = () => {
    const map = mapRef.current;
    if (!map) return;
    if (center) map.easeTo({ center: [center.lng, center.lat], zoom: 12, duration: 600 });
    else map.easeTo({ center: BRAZIL_CENTER, zoom: BRAZIL_ZOOM, duration: 600 });
  };

  return (
    <div className="relative isolate mx-5 mb-3 h-72 overflow-hidden rounded-3xl shadow-card">
      <div ref={containerRef} className="h-full w-full" />
      <div className="absolute right-3 top-3 flex flex-col gap-2">
        <button
          onClick={toggle3d}
          aria-label="3D"
          className="grid h-9 w-9 place-items-center rounded-full bg-white text-gray-800 shadow-md"
        >
          <Box size={16} />
        </button>
        <button
          onClick={recenter}
          aria-label="Recentrar"
          className="grid h-9 w-9 place-items-center rounded-full bg-white text-gray-800 shadow-md"
        >
          <Locate size={16} />
        </button>
        <span className="grid h-9 w-9 place-items-center rounded-full bg-white/70 text-gray-500 shadow-md">
          <Layers size={16} />
        </span>
      </div>
    </div>
  );
}
