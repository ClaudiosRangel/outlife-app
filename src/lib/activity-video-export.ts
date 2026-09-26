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
import { drawMapBackground, isCanvasTainted, type MapProjector } from "@/lib/map-canvas";

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

    // Fundo do MAPA (satélite) desenhado UMA vez num canvas offscreen — idêntico
    // ao "Assistir percurso". A cada frame copiamos esse fundo e desenhamos o
    // traçado por cima (mesma projeção do mapa, via `projector`).
    const bgCanvas = document.createElement("canvas");
    bgCanvas.width = W;
    bgCanvas.height = H;
    const bgCtx = bgCanvas.getContext("2d");
    if (!bgCtx) {
      reject(new Error("Contexto 2D indisponível."));
      return;
    }

    const durationSeconds = input.durationSeconds ?? 0;
    const activityName = input.activityName ?? null;
    const extraMetrics = input.extraMetrics ?? [];
    const videoSeconds = Math.min(20, Math.max(6, input.videoSeconds ?? 12));
    const totalFrames = Math.round(videoSeconds * FPS);
    let frame = 0;

    // Distância total.
    let totalDist = 0;
    for (let i = 1; i < path.length; i++) totalDist += haversineMeters(path[i - 1], path[i]);

    // A geração começa DEPOIS que o mapa de fundo terminou de baixar/desenhar.
    // `padding` reserva espaço superior/inferior para as métricas.
    drawMapBackground(bgCtx, path, W, H, "satellite", 90)
      .then((projector) => {
        // GARANTIA CRÍTICA: se, apesar de tudo, o canvas de fundo taintou
        // (o MediaRecorder produziria um vídeo VAZIO), descartamos o mapa e
        // usamos fundo neutro + projeção do bbox. O vídeo SEMPRE sai.
        if (isCanvasTainted(bgCanvas)) {
          bgCtx.clearRect(0, 0, W, H);
          drawNeutralBackground(bgCtx);
          startRecording(fallbackProjector());
        } else {
          startRecording(projector);
        }
      })
      .catch(() => {
        drawNeutralBackground(bgCtx);
        startRecording(fallbackProjector());
      });

    // Fundo neutro (gradiente escuro) para quando o mapa não puder ser usado.
    function drawNeutralBackground(c: CanvasRenderingContext2D) {
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#0f172a");
      g.addColorStop(1, "#1e293b");
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
    }

    // Projeção de fallback (fit do bbox no canvas) caso o mapa não carregue.
    function fallbackProjector(): MapProjector {
      const pts = path.map((p) => ({
        x: (p.lng + 180) / 360,
        y: 0.5 - Math.log((1 + Math.sin((p.lat * Math.PI) / 180)) / (1 - Math.sin((p.lat * Math.PI) / 180))) / (4 * Math.PI),
      }));
      let mnX = Infinity, mxX = -Infinity, mnY = Infinity, mxY = -Infinity;
      for (const p of pts) { mnX = Math.min(mnX, p.x); mxX = Math.max(mxX, p.x); mnY = Math.min(mnY, p.y); mxY = Math.max(mxY, p.y); }
      const spanX = mxX - mnX || 1e-9, spanY = mxY - mnY || 1e-9;
      const boxX = 90, boxY = 360, boxW = W - 180, boxH = 980;
      const scale = Math.min(boxW / spanX, boxH / spanY);
      const offX = boxX + (boxW - spanX * scale) / 2, offY = boxY + (boxH - spanY * scale) / 2;
      return {
        zoom: 0,
        project: (lat: number, lng: number) => {
          const x = (lng + 180) / 360;
          const s = Math.sin((lat * Math.PI) / 180);
          const y = 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
          return { x: offX + (x - mnX) * scale, y: offY + (y - mnY) * scale };
        },
      };
    }

    function startRecording(projector: MapProjector) {
      const xyPts = path.map((p) => projector.project(p.lat, p.lng));

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
      recorder.ondataavailable = (ev) => { if (ev.data && ev.data.size > 0) chunks.push(ev.data); };
      recorder.onerror = () => reject(new Error("Falha na gravação do vídeo."));
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType.split(";")[0] });
        blob.size === 0 ? reject(new Error("Vídeo vazio.")) : resolve(blob);
      };

    const drawFrame = (progress: number) => {
      // Fundo = mapa satélite (offscreen) + leve escurecimento no topo/base
      // para legibilidade das métricas.
      ctx.drawImage(bgCanvas, 0, 0);
      // Escurecimento no topo para legibilidade da marca + métricas (as
      // métricas agora ficam no topo, como no "Assistir percurso").
      const gTop = ctx.createLinearGradient(0, 0, 0, 380);
      gTop.addColorStop(0, "rgba(0,0,0,0.6)");
      gTop.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gTop;
      ctx.fillRect(0, 0, W, 380);

      // Marca no topo esquerdo (OUTVITAR + tipo) — idêntico ao "Assistir
      // percurso" (nome da modalidade em laranja logo abaixo da marca).
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 10;
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
      ctx.fillStyle = TEXT;
      ctx.font = "700 40px sans-serif";
      ctx.fillText("OUTVITAR", 60, 70);
      if (activityName) {
        ctx.fillStyle = ACCENT;
        ctx.font = "800 44px sans-serif";
        ctx.fillText(activityName.toUpperCase(), 60, 120);
      }
      ctx.restore();

      // Métricas grandes NO TOPO (distância / tempo grandes; vel. média /
      // elevação menores abaixo) — mesmo layout do "Assistir percurso".
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 12;
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
      const topY = 210;
      ctx.fillStyle = TEXT;
      ctx.font = "800 92px sans-serif";
      ctx.fillText(`${((progress * totalDist) / 1000).toFixed(2)}`, 60, topY);
      if (durationSeconds > 0) {
        ctx.fillText(fmtDuration(progress * durationSeconds), 60 + 340, topY);
      }
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = "600 26px sans-serif";
      ctx.fillText("KM", 60, topY + 34);
      if (durationSeconds > 0) ctx.fillText("TEMPO", 60 + 340, topY + 34);
      // Linha de contexto (vel. média / elevação), estáticas.
      let cx = 60;
      const cY = topY + 88;
      for (const m of extraMetrics.slice(0, 2)) {
        ctx.fillStyle = TEXT;
        ctx.font = "700 40px sans-serif";
        ctx.fillText(m.value, cx, cY);
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = "600 24px sans-serif";
        ctx.fillText(m.label.toUpperCase(), cx, cY + 30);
        cx += 320;
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
      // Ponto interpolado atual (mesma projeção do mapa de fundo).
      const curLL = posAt(path, progress);
      const cur = projector.project(curLL.lat, curLL.lng);
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

    };

    // Desenha o 1º frame antes de iniciar (garante conteúdo no stream).
    drawFrame(0);

    // Salvaguarda FINAL: se o canvas de captura ficou tainted (não deveria,
    // já tratamos o bgCanvas), aborta a gravação e rejeita com mensagem clara
    // em vez de gerar um vídeo vazio silencioso.
    if (isCanvasTainted(canvas)) {
      try { recorder.stop(); } catch { /* ignore */ }
      reject(new Error("Canvas contaminado (CORS) — não é possível gravar o vídeo."));
      return;
    }

    let rafId: number | null = null;

    // Animação dirigida por CONTAGEM DE FRAMES (determinística), não por
    // performance.now(): no WebView Android o rAF é throttled e a gravação em
    // tempo real do MediaRecorder cortava o percurso antes do fim. Aqui cada
    // frame do trajeto é efetivamente desenhado e entra no stream.
    // + HOLD_FRAMES no fim: segura o percurso COMPLETO por ~1,5s antes de parar.
    const HOLD_FRAMES = Math.round(1.5 * FPS);
    const animFrames = totalFrames; // frames até progress=1
    const grandTotal = animFrames + HOLD_FRAMES;

    const loop = () => {
      // progress 0..1 ao longo de animFrames; depois fica em 1 (hold).
      const progress = Math.min(1, frame / animFrames);
      drawFrame(progress);
      input.onProgress?.(Math.min(1, frame / grandTotal));
      frame++;
      if (frame > grandTotal) {
        // Dá tempo ao stream capturar os últimos frames antes de encerrar.
        setTimeout(() => {
          try { recorder.stop(); } catch { /* ignore */ }
        }, 400);
        return;
      }
      rafId = requestAnimationFrame(loop);
    };

    try {
      // timeslice curto força ondataavailable periódico → chunks finais não
      // se perdem ao parar (bug do vídeo incompleto).
      recorder.start(250);
      rafId = requestAnimationFrame(loop);
    } catch (e) {
      if (rafId) cancelAnimationFrame(rafId);
      reject(e instanceof Error ? e : new Error(String(e)));
    }
    } // fim startRecording
  });
}


// ============================================================================
// Vídeo do USUÁRIO + métricas/mini-mapa sobrepostos (item C) — compõe o vídeo
// escolhido pelo usuário com as métricas da atividade e o traçado, gerando um
// arquivo compartilhável. Grava enquanto o vídeo toca, no ritmo real dele.
// ============================================================================

export type OverlayVideoInput = {
  /** Elemento <video> já com o src do usuário (será tocado do início). */
  video: HTMLVideoElement;
  path: ExportLatLng[];
  metrics: ExportMetricStatic[];
  activityName?: string | null;
  onProgress?: (p: number) => void;
};

/** Desenha o mini-mapa do trajeto (laranja) num retângulo do canvas. */
function drawMiniRouteRect(
  ctx: CanvasRenderingContext2D,
  path: ExportLatLng[],
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (path.length < 2) return;
  const pts = path.map((p) => project(p.lat, p.lng));
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const spanX = maxX - minX || 1e-9;
  const spanY = maxY - minY || 1e-9;
  const pad = 18;
  const scale = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanY);
  const dw = spanX * scale, dh = spanY * scale;
  const offX = x + (w - dw) / 2, offY = y + (h - dh) / 2;
  const xy = (p: { x: number; y: number }) => ({ x: offX + (p.x - minX) * scale, y: offY + (p.y - minY) * scale });

  // Fundo arredondado semitransparente.
  ctx.save();
  ctx.fillStyle = "rgba(2,6,23,0.45)";
  ctx.beginPath();
  const r = 24;
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.fill();

  ctx.lineJoin = "round"; ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 8;
  ctx.beginPath();
  pts.forEach((p, i) => { const q = xy(p); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
  ctx.stroke();
  ctx.strokeStyle = ACCENT; ctx.lineWidth = 5;
  ctx.beginPath();
  pts.forEach((p, i) => { const q = xy(p); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
  ctx.stroke();
  const s = xy(pts[0]), e = xy(pts[pts.length - 1]);
  ctx.fillStyle = "#22c55e"; ctx.beginPath(); ctx.arc(s.x, s.y, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(e.x, e.y, 7, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/**
 * Compõe o vídeo do usuário com as métricas e o mini-mapa e grava um novo
 * vídeo (webm/mp4). Rejeita se não houver suporte a MediaRecorder.
 * O canvas segue a proporção do vídeo do usuário (até 1080 de largura).
 */
export function generateVideoWithOverlay(input: OverlayVideoInput): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const { video, path, metrics } = input;
    const mimeType = pickVideoMimeType();
    if (mimeType == null || typeof MediaRecorder === "undefined") {
      reject(new Error("Gravação de vídeo não suportada neste dispositivo."));
      return;
    }

    const run = () => {
      const vw = video.videoWidth || 720;
      const vh = video.videoHeight || 1280;
      // Escala para no máximo 1080 de largura, mantendo proporção.
      const scale = Math.min(1, 1080 / vw);
      const cw = Math.round(vw * scale);
      const ch = Math.round(vh * scale);

      const canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Contexto 2D indisponível.")); return; }

      const captureStream = (canvas as HTMLCanvasElement & { captureStream: (fps?: number) => MediaStream }).captureStream;
      const stream = captureStream.call(canvas, FPS);

      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
      } catch (e) { reject(e instanceof Error ? e : new Error(String(e))); return; }

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (ev) => { if (ev.data && ev.data.size > 0) chunks.push(ev.data); };
      recorder.onerror = () => reject(new Error("Falha na gravação do vídeo."));
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType.split(";")[0] });
        blob.size === 0 ? reject(new Error("Vídeo vazio.")) : resolve(blob);
      };

      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
      let rafId: number | null = null;

      const drawFrame = () => {
        // Frame do vídeo.
        try { ctx.drawImage(video, 0, 0, cw, ch); } catch { /* frame ainda não pronto */ }

        // Gradiente na base para legibilidade.
        const g = ctx.createLinearGradient(0, ch - ch * 0.4, 0, ch);
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(1, "rgba(0,0,0,0.75)");
        ctx.fillStyle = g;
        ctx.fillRect(0, ch - ch * 0.4, cw, ch * 0.4);

        // Marca no topo.
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 8;
        ctx.textBaseline = "top"; ctx.textAlign = "left";
        ctx.fillStyle = TEXT; ctx.font = `800 ${Math.round(cw * 0.05)}px sans-serif`;
        ctx.fillText("OUTVITAR", 24, 24);
        if (input.activityName) {
          ctx.fillStyle = ACCENT; ctx.font = `700 ${Math.round(cw * 0.032)}px sans-serif`;
          ctx.fillText(input.activityName.toUpperCase(), 24, 24 + Math.round(cw * 0.055));
        }
        ctx.restore();

        // Métricas na base esquerda (2 colunas x 2 linhas).
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 6;
        ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
        const mBottom = ch - 28;
        const colW = (cw - 48) / 2 - 70; // espaço p/ mini-mapa à direita
        metrics.slice(0, 4).forEach((m, i) => {
          const col = i % 2, row = Math.floor(i / 2);
          const mx = 24 + col * colW;
          const my = mBottom - (1 - row) * Math.round(cw * 0.14);
          ctx.fillStyle = TEXT; ctx.font = `800 ${Math.round(cw * 0.06)}px sans-serif`;
          ctx.fillText(m.value, mx, my);
          ctx.fillStyle = ACCENT; ctx.font = `700 ${Math.round(cw * 0.026)}px sans-serif`;
          ctx.fillText(m.label.toUpperCase(), mx, my - Math.round(cw * 0.062));
        });
        ctx.restore();

        // Mini-mapa no canto inferior direito.
        const mapSize = Math.round(cw * 0.26);
        drawMiniRouteRect(ctx, path, cw - mapSize - 20, ch - mapSize - 20, mapSize, mapSize);

        if (duration > 0) input.onProgress?.(Math.min(1, video.currentTime / duration));

        if (video.ended || video.paused) {
          setTimeout(() => { try { recorder.stop(); } catch { /* ignore */ } }, 300);
          return;
        }
        rafId = requestAnimationFrame(drawFrame);
      };

      const onEnded = () => {
        if (rafId) cancelAnimationFrame(rafId);
        setTimeout(() => { try { recorder.stop(); } catch { /* ignore */ } }, 300);
      };
      video.addEventListener("ended", onEnded, { once: true });

      // Limite de segurança: não grava mais que 60s.
      const safety = setTimeout(() => {
        try { video.pause(); } catch { /* ignore */ }
      }, 60_000);
      recorder.onstop = () => {
        clearTimeout(safety);
        const blob = new Blob(chunks, { type: mimeType.split(";")[0] });
        blob.size === 0 ? reject(new Error("Vídeo vazio.")) : resolve(blob);
      };

      try {
        video.currentTime = 0;
        video.muted = false;
        recorder.start(250);
        video.play().then(() => {
          rafId = requestAnimationFrame(drawFrame);
        }).catch((e) => reject(e instanceof Error ? e : new Error(String(e))));
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    };

    if (video.readyState >= 2 && video.videoWidth > 0) {
      run();
    } else {
      video.addEventListener("loadeddata", run, { once: true });
      video.addEventListener("error", () => reject(new Error("Não foi possível carregar o vídeo.")), { once: true });
    }
  });
}
