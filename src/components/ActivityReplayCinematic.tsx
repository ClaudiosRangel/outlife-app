// Replay cinematográfico em TELA CHEIA (estilo TrivLock): o trajeto no mapa
// (satélite por padrão) com a linha em laranja e um ponto percorrendo o
// caminho, câmera acompanhando, e MÉTRICAS SOBREPOSTAS animando no topo
// (distância percorrida, tempo decorrido) + contexto (velocidade média,
// elevação). Play/pause/reiniciar e fechar. Overlay full-screen.
//
// Base 2D confiável no WebView (Leaflet + tiles Mapbox), sem WebGL.

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Polyline, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { Play, Pause, RotateCcw, X } from "lucide-react";
import type { MapLayerKey } from "@/lib/map-config";
import { MapTileLayer } from "@/components/map-layers";
import { haversineMeters } from "@/lib/haversine";

const startIcon = L.icon({
  iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow,
  iconSize: [25, 41], iconAnchor: [12, 41],
});

export type LatLng = { lat: number; lng: number };

function fmtDuration(s: number): string {
  const t = Math.max(0, Math.round(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export default function ActivityReplayCinematic({
  path,
  durationSeconds = 0,
  averageSpeedLabel,
  elevationLabel,
  activityName,
  onClose,
}: {
  path: LatLng[];
  durationSeconds?: number;
  averageSpeedLabel?: string | null;
  elevationLabel?: string | null;
  activityName?: string | null;
  onClose: () => void;
}) {
  const [layer] = useState<MapLayerKey>("satellite");
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startTsRef = useRef<number>(0);
  const baseRef = useRef<number>(0);

  const cumDist = useMemo(() => {
    const arr = [0];
    for (let i = 1; i < path.length; i++) arr[i] = arr[i - 1] + haversineMeters(path[i - 1], path[i]);
    return arr;
  }, [path]);
  const totalDist = cumDist[cumDist.length - 1] ?? 0;

  // Duração da animação cinematográfica: 15s (12-22s conforme tamanho).
  const animMs = Math.min(22000, Math.max(12000, path.length * 80));

  const pos = useMemo(() => posAt(path, progress), [path, progress]);
  const distNow = progress * totalDist;
  const timeNow = progress * durationSeconds;

  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    startTsRef.current = performance.now();
    baseRef.current = progress >= 1 ? 0 : progress;
    if (progress >= 1) setProgress(0);
    const tick = (now: number) => {
      const p = Math.min(1, baseRef.current + (now - startTsRef.current) / animMs);
      setProgress(p);
      if (p >= 1) { setPlaying(false); return; }
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
    <div className="fixed inset-0 z-[3000] bg-black">
      <MapContainer
        center={center}
        zoom={15}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
        zoomControl={false}
        attributionControl={false}
      >
        <MapTileLayer layer={layer} />
        {/* Halo escuro + linha laranja estilo TrivLock */}
        <Polyline positions={line} pathOptions={{ color: "#000000", weight: 9, opacity: 0.4 }} />
        <Polyline positions={line} pathOptions={{ color: "#f97316", weight: 5, opacity: 0.95 }} />
        <Marker position={[path[0].lat, path[0].lng]} icon={startIcon} />
        {pos && (
          <CircleMarker
            center={[pos.lat, pos.lng]}
            radius={10}
            pathOptions={{ color: "#ffffff", fillColor: "#f97316", fillOpacity: 1, weight: 4 }}
          />
        )}
        <FollowCam pos={playing ? pos : null} />
      </MapContainer>

      {/* Métricas sobrepostas no topo (animando) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[3100] bg-gradient-to-b from-black/75 to-transparent px-5 pb-10 pt-[env(safe-area-inset-top,20px)]">
        <div className="flex items-start justify-between pt-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">OUTVITAR</div>
            {activityName && (
              <div className="text-sm font-semibold text-[#f97316]">{activityName.toUpperCase()}</div>
            )}
          </div>
          <button
            onClick={onClose}
            className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white backdrop-blur active:scale-95"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 flex gap-6">
          <div>
            <div className="font-display text-5xl font-bold tabular-nums text-white drop-shadow-lg">
              {(distNow / 1000).toFixed(2)}
            </div>
            <div className="text-[11px] uppercase tracking-widest text-white/70">km</div>
          </div>
          {durationSeconds > 0 && (
            <div>
              <div className="font-display text-5xl font-bold tabular-nums text-white drop-shadow-lg">
                {fmtDuration(timeNow)}
              </div>
              <div className="text-[11px] uppercase tracking-widest text-white/70">tempo</div>
            </div>
          )}
        </div>

        <div className="mt-2 flex gap-6">
          {averageSpeedLabel && (
            <div className="text-white/90">
              <span className="font-display text-xl font-semibold tabular-nums">{averageSpeedLabel}</span>
              <span className="ml-1 text-[11px] uppercase tracking-widest text-white/60">vel. média</span>
            </div>
          )}
          {elevationLabel && elevationLabel !== "—" && (
            <div className="text-white/90">
              <span className="font-display text-xl font-semibold tabular-nums">{elevationLabel}</span>
              <span className="ml-1 text-[11px] uppercase tracking-widest text-white/60">elevação</span>
            </div>
          )}
        </div>
      </div>

      {/* Controles na base */}
      <div className="absolute inset-x-0 bottom-0 z-[3100] bg-gradient-to-t from-black/80 to-transparent p-5 pb-[calc(env(safe-area-inset-bottom,16px)+16px)] pt-10">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/25">
          <div className="h-full bg-[#f97316]" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <div className="mt-4 flex items-center justify-center gap-4">
          <button
            onClick={() => { setPlaying(false); setProgress(0); }}
            className="grid h-11 w-11 place-items-center rounded-full bg-white/20 text-white backdrop-blur active:scale-95"
            aria-label="Reiniciar"
          >
            <RotateCcw size={18} />
          </button>
          <button
            onClick={() => setPlaying((v) => !v)}
            className="grid h-16 w-16 place-items-center rounded-full bg-[#f97316] text-white shadow-lg active:scale-95"
            aria-label={playing ? "Pausar" : "Reproduzir"}
          >
            {playing ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" />}
          </button>
          <div className="h-11 w-11" />
        </div>
      </div>
    </div>
  );
}

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
