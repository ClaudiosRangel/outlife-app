import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Polyline, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { Play, Pause, RotateCcw } from "lucide-react";
import type { MapLayerKey } from "@/lib/map-config";
import { MapLayerControl, MapTileLayer } from "@/components/map-layers";
import { haversineMeters } from "@/lib/haversine";

const startIcon = L.icon({
  iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow,
  iconSize: [25, 41], iconAnchor: [12, 41],
});

export type LatLng = { lat: number; lng: number };

/**
 * Replay 2D do percurso (item 2 — o "Flyover" do Strava, versão 2D confiável
 * no WebView). Anima um ponto percorrendo o trajeto com a câmera acompanhando,
 * play/pause/reiniciar e barra de progresso com distância percorrida.
 * `path` em {lat,lng}. `durationSeconds` opcional só para exibir tempo.
 */
export default function ActivityReplayMap({
  path,
  height = 320,
}: {
  path: LatLng[];
  height?: number;
}) {
  const [layer, setLayer] = useState<MapLayerKey>("outdoors");
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const rafRef = useRef<number | null>(null);
  const startTsRef = useRef<number>(0);
  const baseProgressRef = useRef<number>(0);

  // Distância acumulada por índice (para mostrar km percorridos no replay).
  const cumDist = useMemo(() => {
    const arr = [0];
    for (let i = 1; i < path.length; i++) {
      arr[i] = arr[i - 1] + haversineMeters(path[i - 1], path[i]);
    }
    return arr;
  }, [path]);
  const totalDist = cumDist[cumDist.length - 1] ?? 0;

  // Duração da animação: 12s (ajustada para trajetos longos até 20s).
  const animMs = Math.min(20000, Math.max(8000, path.length * 60));

  // Posição interpolada ao longo do trajeto conforme o progresso.
  const pos = useMemo(() => posAt(path, progress), [path, progress]);
  const distNow = progress * totalDist;

  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    startTsRef.current = performance.now();
    baseProgressRef.current = progress >= 1 ? 0 : progress;
    if (progress >= 1) setProgress(0);
    const tick = (now: number) => {
      const elapsed = now - startTsRef.current;
      const p = Math.min(1, baseProgressRef.current + elapsed / animMs);
      setProgress(p);
      if (p >= 1) {
        setPlaying(false);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  if (path.length < 2) return null;
  const center: [number, number] = [path[0].lat, path[0].lng];
  const line = path.map((p) => [p.lat, p.lng]) as [number, number][];

  return (
    <div className="relative isolate overflow-hidden rounded-2xl shadow-card" style={{ height }}>
      <MapLayerControl layer={layer} onChange={setLayer} />
      <MapContainer center={center} zoom={14} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
        <MapTileLayer layer={layer} />
        <Polyline positions={line} pathOptions={{ color: "#16a34a", weight: 5, opacity: 0.85 }} />
        <Marker position={[path[0].lat, path[0].lng]} icon={startIcon} />
        {/* Ponto animado */}
        {pos && (
          <CircleMarker
            center={[pos.lat, pos.lng]}
            radius={9}
            pathOptions={{ color: "#f97316", fillColor: "#f97316", fillOpacity: 1, weight: 3 }}
          />
        )}
        <FollowCam pos={playing ? pos : null} />
      </MapContainer>

      {/* Controles do replay */}
      <div className="absolute inset-x-0 bottom-0 z-[1000] bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPlaying((v) => !v)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95"
            aria-label={playing ? "Pausar" : "Assistir percurso"}
          >
            {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>
          <button
            onClick={() => { setPlaying(false); setProgress(0); }}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/20 text-white backdrop-blur active:scale-95"
            aria-label="Reiniciar"
          >
            <RotateCcw size={15} />
          </button>
          <div className="min-w-0 flex-1">
            {/* Barra de progresso (clicável para arrastar não — só visual) */}
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/30">
              <div className="h-full bg-primary transition-[width] duration-100" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-[11px] font-medium text-white">
              <span>{(distNow / 1000).toFixed(2)} km</span>
              <span>{(totalDist / 1000).toFixed(2)} km</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Posição interpolada no trajeto para um progresso 0..1 (por índice, simples).
function posAt(path: LatLng[], progress: number): LatLng | null {
  if (path.length === 0) return null;
  if (progress <= 0) return path[0];
  if (progress >= 1) return path[path.length - 1];
  const f = progress * (path.length - 1);
  const i = Math.floor(f);
  const t = f - i;
  const a = path[i];
  const b = path[Math.min(i + 1, path.length - 1)];
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

function FollowCam({ pos }: { pos: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (pos) map.panTo([pos.lat, pos.lng], { animate: true, duration: 0.3 });
  }, [pos, map]);
  return null;
}
