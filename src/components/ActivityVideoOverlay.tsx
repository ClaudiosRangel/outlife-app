// Overlay de VÍDEO próprio com métricas sobrepostas + mini-mapa do trajeto em
// laranja no canto (estilo TrivLock, 2º print): o usuário escolhe um vídeo do
// dispositivo, o vídeo toca em tela cheia e por cima ficam as métricas da
// atividade (distância/tempo/elevação/velocidade) e um mini-traçado do
// percurso. Serve para gravar a tela / compartilhar o resultado.
//
// O mini-mapa é desenhado num <canvas> (mesma projeção do story-generator),
// sem depender de tiles — confiável e leve sobre o vídeo.

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export type LatLng = { lat: number; lng: number };

function project(lat: number, lng: number) {
  const x = (lng + 180) / 360;
  const s = Math.sin((lat * Math.PI) / 180);
  const y = 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
  return { x, y };
}

function drawMiniRoute(canvas: HTMLCanvasElement, path: LatLng[]) {
  const ctx = canvas.getContext("2d");
  if (!ctx || path.length < 2) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const pts = path.map((p) => project(p.lat, p.lng));
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const spanX = maxX - minX || 1e-9;
  const spanY = maxY - minY || 1e-9;
  const pad = 14;
  const scale = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanY);
  const dw = spanX * scale;
  const dh = spanY * scale;
  const offX = (w - dw) / 2;
  const offY = (h - dh) / 2;
  const xy = (p: { x: number; y: number }) => ({ x: offX + (p.x - minX) * scale, y: offY + (p.y - minY) * scale });

  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  pts.forEach((p, i) => { const q = xy(p); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
  ctx.stroke();
  ctx.strokeStyle = "#f97316";
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  pts.forEach((p, i) => { const q = xy(p); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
  ctx.stroke();

  const s = xy(pts[0]);
  const e = xy(pts[pts.length - 1]);
  ctx.fillStyle = "#22c55e";
  ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.arc(e.x, e.y, 5, 0, Math.PI * 2); ctx.fill();
}

export default function ActivityVideoOverlay({
  videoUrl,
  path,
  metrics,
  activityName,
  onClose,
}: {
  videoUrl: string;
  path: LatLng[];
  metrics: { label: string; value: string }[];
  activityName?: string | null;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) drawMiniRoute(canvasRef.current, path);
  }, [path]);

  return (
    <div className="fixed inset-0 z-[3000] bg-black">
      <video
        src={videoUrl}
        className="h-full w-full object-contain"
        autoPlay
        controls
        playsInline
      />

      {/* Marca + fechar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[3100] flex items-start justify-between bg-gradient-to-b from-black/70 to-transparent px-5 pb-10 pt-[calc(env(safe-area-inset-top,20px)+12px)]">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">OUTVITAR</div>
          {activityName && <div className="text-sm font-semibold text-[#f97316]">{activityName.toUpperCase()}</div>}
        </div>
        <button
          onClick={onClose}
          className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white backdrop-blur active:scale-95"
          aria-label="Fechar"
        >
          <X size={18} />
        </button>
      </div>

      {/* Métricas + mini-mapa sobrepostos na base */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[3100] flex items-end justify-between gap-4 bg-gradient-to-t from-black/80 to-transparent px-5 pb-[calc(env(safe-area-inset-bottom,16px)+16px)] pt-12">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          {metrics.slice(0, 4).map((m) => (
            <div key={m.label}>
              <div className="font-display text-3xl font-bold tabular-nums text-white drop-shadow-lg">{m.value}</div>
              <div className="text-[10px] uppercase tracking-widest text-white/70">{m.label}</div>
            </div>
          ))}
        </div>
        <canvas
          ref={canvasRef}
          width={150}
          height={150}
          className="h-[120px] w-[120px] shrink-0 rounded-2xl bg-black/40 backdrop-blur"
        />
      </div>
    </div>
  );
}
