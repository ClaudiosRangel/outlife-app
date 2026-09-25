// Renderização do MAPA (tiles raster Mapbox) direto num <canvas>, para compor
// o fundo do vídeo de export idêntico ao "Assistir percurso" (que usa Leaflet
// + satélite). O MediaRecorder só grava canvas — o Leaflet não pode ser
// gravado — então baixamos os tiles da região do trajeto e os desenhamos aqui,
// com a MESMA projeção Web Mercator usada para plotar o traçado por cima.

import { getMapboxToken, MAP_LAYERS, type MapLayerKey } from "@/lib/map-config";

export type LatLng = { lat: number; lng: number };

const TILE = 256; // tamanho lógico do tile na projeção (px por tile no zoom Z)

/** Projeção Web Mercator → pixel global (no nível de zoom `z`). */
function lngLatToPixel(lat: number, lng: number, z: number): { x: number; y: number } {
  const scale = TILE * Math.pow(2, z);
  const x = ((lng + 180) / 360) * scale;
  const s = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale;
  return { x, y };
}

function bounds(path: LatLng[]) {
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const p of path) {
    minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng); maxLng = Math.max(maxLng, p.lng);
  }
  return { minLat, maxLat, minLng, maxLng };
}

/** Escolhe o maior zoom em que o bbox (com padding) cabe no canvas WxH. */
function pickZoom(path: LatLng[], w: number, h: number, paddingPx: number): number {
  const b = bounds(path);
  for (let z = 18; z >= 2; z--) {
    const a = lngLatToPixel(b.minLat, b.minLng, z);
    const c = lngLatToPixel(b.maxLat, b.maxLng, z);
    const spanX = Math.abs(c.x - a.x);
    const spanY = Math.abs(c.y - a.y);
    if (spanX <= w - paddingPx * 2 && spanY <= h - paddingPx * 2) return z;
  }
  return 2;
}

type DrawableTile = HTMLImageElement | ImageBitmap;

/**
 * Carrega um tile de forma que NÃO "suje" (taint) o canvas — essencial para o
 * canvas poder ser capturado pelo MediaRecorder (o vídeo). Em vez de
 * `<img crossOrigin>` (que pode reusar uma entrada de cache SEM headers CORS,
 * deixada pelo Leaflet, e tainta o canvas), buscamos via `fetch` (CORS),
 * viramos Blob LOCAL e decodificamos — blob local nunca tainta.
 */
async function loadTile(url: string): Promise<DrawableTile> {
  const res = await fetch(url, { mode: "cors", cache: "reload" });
  if (!res.ok) throw new Error(`tile ${res.status}`);
  const blob = await res.blob();
  if (typeof createImageBitmap === "function") {
    return await createImageBitmap(blob);
  }
  // Fallback: objectURL (também local → não tainta).
  const objectUrl = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("tile decode"));
      img.src = objectUrl;
    });
  } finally {
    // Revoga depois de um tick para garantir que o decode terminou.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
  }
}

export type MapProjector = {
  /** Converte lat/lng em coordenada de pixel DENTRO do canvas (WxH). */
  project: (lat: number, lng: number) => { x: number; y: number };
  zoom: number;
};

/**
 * Desenha o mapa (tiles da `layer`) cobrindo o canvas WxH, centralizado no
 * trajeto `path`. Retorna um projetor para plotar o traçado por cima na mesma
 * geometria. Se não houver token/tiles falharem, desenha um fundo neutro e
 * ainda assim retorna um projetor válido (fit do bbox), para o traçado aparecer.
 *
 * `padding` deixa margem para o traçado não colar nas bordas.
 */
export async function drawMapBackground(
  ctx: CanvasRenderingContext2D,
  path: LatLng[],
  w: number,
  h: number,
  layer: MapLayerKey = "satellite",
  padding = 80,
): Promise<MapProjector> {
  const token = getMapboxToken();
  const z = pickZoom(path, w, h, padding);
  const b = bounds(path);

  // Centro do bbox em pixel global; origem do canvas = centro - metade do canvas.
  const centerLat = (b.minLat + b.maxLat) / 2;
  const centerLng = (b.minLng + b.maxLng) / 2;
  const center = lngLatToPixel(centerLat, centerLng, z);
  const originX = center.x - w / 2;
  const originY = center.y - h / 2;

  const project = (lat: number, lng: number) => {
    const p = lngLatToPixel(lat, lng, z);
    return { x: p.x - originX, y: p.y - originY };
  };

  // Fundo neutro (fallback) sempre desenhado primeiro.
  ctx.fillStyle = "#1f2937";
  ctx.fillRect(0, 0, w, h);

  if (!token) return { project, zoom: z };

  const style = MAP_LAYERS.find((l) => l.key === layer)?.style ?? "satellite-streets-v12";

  // Tiles que interceptam a viewport [originX..originX+w] x [originY..originY+h].
  const tileMinX = Math.floor(originX / TILE);
  const tileMaxX = Math.floor((originX + w) / TILE);
  const tileMinY = Math.floor(originY / TILE);
  const tileMaxY = Math.floor((originY + h) / TILE);
  const maxTileIndex = Math.pow(2, z) - 1;

  // Baixa TODOS os tiles primeiro (blobs locais), depois desenha em ordem —
  // evita desenhar parcialmente e garante que nada tainte o canvas.
  const tiles: Array<{ img: DrawableTile; dx: number; dy: number }> = [];
  const jobs: Promise<void>[] = [];
  for (let tx = tileMinX; tx <= tileMaxX; tx++) {
    for (let ty = tileMinY; ty <= tileMaxY; ty++) {
      if (tx < 0 || ty < 0 || tx > maxTileIndex || ty > maxTileIndex) continue;
      const url = `https://api.mapbox.com/styles/v1/mapbox/${style}/tiles/256/${z}/${tx}/${ty}?access_token=${token}`;
      const dx = tx * TILE - originX;
      const dy = ty * TILE - originY;
      jobs.push(
        loadTile(url)
          .then((img) => { tiles.push({ img, dx, dy }); })
          .catch(() => { /* tile faltando: fundo neutro aparece nessa área */ }),
      );
    }
  }
  await Promise.all(jobs);
  for (const t of tiles) {
    try {
      ctx.drawImage(t.img, t.dx, t.dy, TILE, TILE);
    } catch { /* ignore */ }
    if (typeof ImageBitmap !== "undefined" && t.img instanceof ImageBitmap) t.img.close();
  }
  return { project, zoom: z };
}

/**
 * Diagnóstico: true se o canvas está "tainted" (não pode ser lido/capturado).
 * Usado pelo export de vídeo para saber se o mapa entrará ou não no vídeo.
 */
export function isCanvasTainted(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext("2d");
  if (!ctx) return true;
  try {
    ctx.getImageData(0, 0, 1, 1);
    return false;
  } catch {
    return true;
  }
}
