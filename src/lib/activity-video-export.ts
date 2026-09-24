// Export de VÍDEO real do replay do percurso (compartilhável), renderizado
// inteiramente num <canvas> próprio (SEM Leaflet/tiles/WebGL — o que é
// inviável de gravar no WebView Android) e capturado via
// `canvas.captureStream()` + `MediaRecorder`. Gera um Blob de vídeo
// (webm/mp4 conforme suporte) que pode ir direto para `shareContent`.
//
// Formato 9:16 (1080x1920) para stories. O trajeto é desenhado em laranja
// estilo TrivLock com o ponto percorrendo; as métricas (distância/tempo
// acumulados) animam no topo; marca OUTVITAR fixa.

import { haversineMeters } from "@/lib/haversine";

export type ExportLatLng = { lat: number; lng: number };
export type ExportMetricStatic = { label: string; value: string };

export type VideoExportInput = {
  path: ExportLatLng[];
  /** Duração real da atividade (s), para animar o tempo decorrido. 0 = oculta. */
  durationSeconds?: number;
  /** Nome do tipo (ex.: "Pedalada"), exibido no topo. */
  activityName?: string | null;
  /** Métricas estáticas extras exibidas na base (ex.: vel. média, elevação). */
  extraMetrics?: ExportMetricStatic[];
  /** Duração do vídeo gerado, em segundos (default 12, faixa 6–20). */
  videoSeconds?: number;
  /** Progresso 0..1 durante a geração (para UI). */
  onProgress?: (p: number) => void;
};

const W = 1080;
const H = 1920;
const FPS = 30;
const ACCENT = "#f97316";
const TEXT = "#f8fafc";

function project(lat: number, lng: number) {
  const x = (lng + 180) / 360;
  const s = Math.sin((lat * Math.PI) / 180);
  const y = 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
  return { x, y };
}

function fmtDuration(s: number): string {
  const t = Math.max(0, Math.round(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** Escolhe o melhor mimeType de vídeo suportado pelo MediaRecorder. */
export function pickVideoMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "video/mp4;codecs=h264",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return c;
    } catch {
      /* ignore */
    }
  }
  return null;
}

/** True quando dá para gravar vídeo neste ambiente (canvas.captureStream + MediaRecorder). */
export function canExportVideo(): boolean {
  if (typeof document === "undefined") return false;
  const c = document.createElement("canvas");
  const hasCapture = typeof (c as HTMLCanvasElement & { captureStream?: unknown }).captureStream === "function";
  return hasCapture && pickVideoMimeType() != null;
}

function posAt(path: ExportLatLng[], progress: number): ExportLatLng {
  if (progress <= 0) return path[0];
  if (progress >= 1) return path[path.length - 1];
  const f = progress * (path.length - 1);
  const i = Math.floor(f);
  const t = f - i;
  const a = path[i];
  const b = path[Math.min(i + 1, path.length - 1)];
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

/**
 * Gera o vídeo do replay. Resolve com o Blob do vídeo, ou rejeita em falha.
 * NÃO usa Leaflet — desenha tudo no canvas, garantindo captura estável.
 */
export function generateActivityVideo(input: VideoExportInput): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const { path } = input;
    if (!path || path.length < 2) {
      reject(new Error("Trajeto insuficiente para gerar vídeo."));
      return;
    }
    const mimeType = pickVideoMimeType();
    if (mimeType == null || typeof MediaRecorder === "undefined") {
      reject(new Error("Gravação de vídeo não suportada neste dispositivo."));
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Contexto 2D indisponível."));
      return;
    }

    const captureStream = (canvas as HTMLCanvasElement & { captureStream: (fps?: number) => MediaStream }).captureStream;
    const stream = captureStream.call(canvas, FPS);

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
      return;
    }

    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunks.push(ev.data);
    };
    recorder.onerror = () => reject(new Error("Falha na gravação do vídeo."));
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType.split(";")[0] });
      if (blob.size === 0) reject(new Error("Vídeo vazio."));
      else resolve(blob);
    };

    // Pré-calcula projeção e caixa de desenho do trajeto.
    const pts = path.map((p) => project(p.lat, p.lng));
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    const spanX = maxX - minX || 1e-9;
    const spanY = maxY - minY || 1e-9;
    const boxX = 90, boxY = 360, boxW = W - 180, boxH = 980;
    const scale = Math.min(boxW / spanX, boxH / spanY);
    const drawW = spanX * scale, drawH = spanY * scale;
    const offX = boxX + (boxW - drawW) / 2;
    const offY = boxY + (boxH - drawH) / 2;
    const toXY = (p: { x: number; y: number }) => ({ x: offX + (p.x - minX) * scale, y: offY + (p.y - minY) * scale });
    const xyPts = pts.map(toXY);

    // Distância total.
    let totalDist = 0;
    for (let i = 1; i < path.length; i++) totalDist += haversineMeters(path[i - 1], path[i]);

    const durationSeconds = input.durationSeconds ?? 0;
    const activityName = input.activityName ?? null;
    const extraMetrics = input.extraMetrics ?? [];

    const videoSeconds = Math.min(20, Math.max(6, input.videoSeconds ?? 12));
    const totalFrames = Math.round(videoSeconds * FPS);
    let frame = 0;

    const drawFrame = (progress: number) => {
      // Fundo gradiente.
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#0b3d2e");
      g.addColorStop(0.55, "#0f172a");
      g.addColorStop(1, "#020617");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // Marca no topo.
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 12;
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
      ctx.fillStyle = TEXT;
      ctx.font = "800 60px sans-serif";
      ctx.fillText("OUTVITAR", 90, 150);
      ctx.font = "600 30px sans-serif";
      ctx.fillStyle = "rgba(248,250,252,0.8)";
      ctx.fillText("VIVER É DIFERENTE DE ESTAR VIVO", 90, 196);
      if (activityName) {
        ctx.textAlign = "right";
        ctx.fillStyle = ACCENT;
        ctx.font = "700 38px sans-serif";
        ctx.fillText(activityName.toUpperCase(), W - 90, 150);
      }
      ctx.restore();

      // Trajeto completo (halo + laranja tênue).
      ctx.save();
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = 22;
      ctx.beginPath();
      xyPts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.stroke();
      ctx.strokeStyle = "rgba(249,115,22,0.35)";
      ctx.lineWidth = 12;
      ctx.beginPath();
      xyPts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.stroke();

      // Trecho já percorrido (laranja forte) até o progresso.
      const upto = progress * (xyPts.length - 1);
      const lastIdx = Math.floor(upto);
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 14;
      ctx.beginPath();
      for (let i = 0; i <= lastIdx; i++) {
        const q = xyPts[i];
        i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y);
      }
      // Ponto interpolado atual.
      const cur = toXY(project(posAt(path, progress).lat, posAt(path, progress).lng));
      ctx.lineTo(cur.x, cur.y);
      ctx.stroke();
      ctx.restore();

      // Marcador início + ponto atual.
      ctx.fillStyle = "#22c55e";
      ctx.beginPath(); ctx.arc(xyPts[0].x, xyPts[0].y, 15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(cur.x, cur.y, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = ACCENT;
      ctx.beginPath(); ctx.arc(cur.x, cur.y, 9, 0, Math.PI * 2); ctx.fill();

      // Métricas animando na base.
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 10;
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
      const baseY = 1520;
      // Distância percorrida.
      ctx.fillStyle = ACCENT;
      ctx.font = "700 30px sans-serif";
      ctx.fillText("DISTÂNCIA", 90, baseY);
      ctx.fillStyle = TEXT;
      ctx.font = "800 84px sans-serif";
      ctx.fillText(`${((progress * totalDist) / 1000).toFixed(2)} km`, 90, baseY + 84);
      // Tempo decorrido.
      if (durationSeconds > 0) {
        ctx.fillStyle = ACCENT;
        ctx.font = "700 30px sans-serif";
        ctx.fillText("TEMPO", W / 2 + 20, baseY);
        ctx.fillStyle = TEXT;
        ctx.font = "800 84px sans-serif";
        ctx.fillText(fmtDuration(progress * durationSeconds), W / 2 + 20, baseY + 84);
      }
      // Extras (vel. média / elevação) em uma linha abaixo.
      let ex = 90;
      const exY = baseY + 200;
      for (const m of extraMetrics.slice(0, 2)) {
        ctx.fillStyle = ACCENT;
        ctx.font = "700 26px sans-serif";
        ctx.fillText(m.label.toUpperCase(), ex, exY);
        ctx.fillStyle = TEXT;
        ctx.font = "800 56px sans-serif";
        ctx.fillText(m.value, ex, exY + 60);
        ex = W / 2 + 20;
      }
      ctx.restore();
    };

    // Desenha o 1º frame antes de iniciar (garante conteúdo no stream).
    drawFrame(0);

    let rafId: number | null = null;
    const startTs = performance.now();

    const loop = (now: number) => {
      const elapsed = (now - startTs) / 1000;
      const progress = Math.min(1, elapsed / videoSeconds);
      drawFrame(progress);
      frame++;
      input.onProgress?.(progress);
      if (progress >= 1 || frame > totalFrames + FPS) {
        // Garante alguns frames finais estáticos e para.
        setTimeout(() => {
          try { recorder.stop(); } catch { /* ignore */ }
        }, 200);
        return;
      }
      rafId = requestAnimationFrame(loop);
    };

    try {
      recorder.start();
      rafId = requestAnimationFrame(loop);
    } catch (e) {
      if (rafId) cancelAnimationFrame(rafId);
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}
