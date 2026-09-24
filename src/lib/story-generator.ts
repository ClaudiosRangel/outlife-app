// Gerador de "story" 9:16 (1080×1920) para compartilhar a atividade estilo
// TrivLock/Strava: fundo premium, o TRAJETO desenhado em laranja (sem depender
// de tiles/Leaflet — confiável no WebView Android), marca OUTVITAR e as
// métricas grandes sobrepostas. Client-side via <canvas>, exporta WebP.
//
// Por que desenhar o trajeto no canvas (e não capturar o mapa Leaflet):
// capturar o WebView/Leaflet para um canvas é frágil (tiles CORS, timing) e
// já é evitado no projeto. Aqui projetamos os pontos lat/lng num retângulo do
// canvas com Web Mercator simples — resultado nítido e determinístico.

import { haversineMeters } from "@/lib/haversine";

export type StoryLatLng = { lat: number; lng: number };

export type StoryMetric = { label: string; value: string };

export type StoryInput = {
  path: StoryLatLng[];
  activityName?: string | null;
  /** Métricas grandes (ex.: distância, tempo, elevação, ritmo/velocidade). */
  metrics: StoryMetric[];
  /** Foto/imagem de fundo opcional (ex.: foto da atividade). */
  backgroundUrl?: string | null;
};

const W = 1080;
const H = 1920;
const QUALITY = 0.92;
const ACCENT = "#f97316"; // laranja TrivLock
const TEXT = "#f8fafc";

/** Projeção Web Mercator (só a parte necessária para caber num retângulo). */
function project(lat: number, lng: number): { x: number; y: number } {
  const x = (lng + 180) / 360;
  const s = Math.sin((lat * Math.PI) / 180);
  const y = 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
  return { x, y };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Falha ao carregar imagem: ${url}`));
    img.src = url;
  });
}

/** Desenha um fundo gradiente escuro premium (fallback / base sob a foto). */
function drawGradientBackground(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#0b3d2e");
  g.addColorStop(0.55, "#0f172a");
  g.addColorStop(1, "#020617");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawImageCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement) {
  const cr = W / H;
  const ir = img.width / img.height;
  let dw: number, dh: number, ox = 0, oy = 0;
  if (ir > cr) {
    dh = H; dw = dh * ir; ox = (W - dw) / 2;
  } else {
    dw = W; dh = dw / ir; oy = (H - dh) / 2;
  }
  ctx.drawImage(img, ox, oy, dw, dh);
  // Escurece para legibilidade.
  ctx.fillStyle = "rgba(2, 6, 23, 0.55)";
  ctx.fillRect(0, 0, W, H);
}

/** Desenha o trajeto laranja projetado dentro de um retângulo central. */
function drawRoute(ctx: CanvasRenderingContext2D, path: StoryLatLng[]) {
  if (path.length < 2) return;
  const pts = path.map((p) => project(p.lat, p.lng));
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const spanX = maxX - minX || 1e-9;
  const spanY = maxY - minY || 1e-9;

  // Área de desenho do trajeto (deixa espaço p/ métricas embaixo e marca no topo).
  const boxX = 90, boxY = 300, boxW = W - 180, boxH = 900;
  const scale = Math.min(boxW / spanX, boxH / spanY);
  const drawW = spanX * scale;
  const drawH = spanY * scale;
  const offX = boxX + (boxW - drawW) / 2;
  const offY = boxY + (boxH - drawH) / 2;

  const toXY = (p: { x: number; y: number }) => ({
    x: offX + (p.x - minX) * scale,
    y: offY + (p.y - minY) * scale,
  });

  // Sombra/halo do trajeto.
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 22;
  ctx.beginPath();
  pts.forEach((p, i) => { const q = toXY(p); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
  ctx.stroke();

  // Linha laranja principal.
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 14;
  ctx.beginPath();
  pts.forEach((p, i) => { const q = toXY(p); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
  ctx.stroke();
  ctx.restore();

  // Marcadores início (verde) e fim (branco).
  const start = toXY(pts[0]);
  const end = toXY(pts[pts.length - 1]);
  ctx.fillStyle = "#22c55e";
  ctx.beginPath(); ctx.arc(start.x, start.y, 16, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.arc(end.x, end.y, 16, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ACCENT;
  ctx.beginPath(); ctx.arc(end.x, end.y, 8, 0, Math.PI * 2); ctx.fill();
}

function drawBrand(ctx: CanvasRenderingContext2D, activityName?: string | null) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 12;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = TEXT;
  ctx.font = "800 60px sans-serif";
  ctx.fillText("OUTVITAR", 90, 170);
  ctx.font = "600 34px sans-serif";
  ctx.fillStyle = "rgba(248,250,252,0.8)";
  ctx.fillText("VIVER É DIFERENTE DE ESTAR VIVO", 90, 220);
  if (activityName) {
    ctx.textAlign = "right";
    ctx.fillStyle = ACCENT;
    ctx.font = "700 40px sans-serif";
    ctx.fillText(activityName.toUpperCase(), W - 90, 170);
  }
  ctx.restore();
}

/** Desenha as métricas grandes na base, em duas colunas. */
function drawMetrics(ctx: CanvasRenderingContext2D, metrics: StoryMetric[]) {
  const baseY = 1360;
  const rowH = 150;
  const colW = (W - 180) / 2;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 10;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  metrics.slice(0, 6).forEach((m, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 90 + col * colW;
    const y = baseY + row * rowH;
    ctx.fillStyle = ACCENT;
    ctx.font = "700 30px sans-serif";
    ctx.fillText(m.label.toUpperCase(), x, y);
    ctx.fillStyle = TEXT;
    ctx.font = "800 76px sans-serif";
    ctx.fillText(m.value, x, y + 78);
  });
  ctx.restore();
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob retornou null"))),
      "image/webp",
      QUALITY,
    );
  });
}

/**
 * Distância total do trajeto em km (conveniência para o chamador montar as
 * métricas quando não tiver o total pronto).
 */
export function routeTotalKm(path: StoryLatLng[]): number {
  let d = 0;
  for (let i = 1; i < path.length; i++) d += haversineMeters(path[i - 1], path[i]);
  return d / 1000;
}

/** Gera o story 9:16 da atividade. Rejeita em falha (nunca imagem parcial). */
export async function generateActivityStory(input: StoryInput): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Contexto 2D indisponível para o story.");

  if (input.backgroundUrl) {
    try {
      const img = await loadImage(input.backgroundUrl);
      drawImageCover(ctx, img);
    } catch {
      drawGradientBackground(ctx);
    }
  } else {
    drawGradientBackground(ctx);
  }

  drawBrand(ctx, input.activityName);
  drawRoute(ctx, input.path);
  drawMetrics(ctx, input.metrics);

  return toBlob(canvas);
}
