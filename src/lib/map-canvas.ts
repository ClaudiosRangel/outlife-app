// Renderização do MAPA para compor o fundo do vídeo de export (idêntico ao
// "Assistir percurso"). O MediaRecorder só grava canvas, e o Leaflet não é
// gravável. As 3 tentativas anteriores baixavam DEZENAS de tiles raster e os
// desenhavam no canvas — no WebView Android/produção isso "taintava" o canvas
// (CORS), o vídeo saía vazio ou sem mapa (só o traçado, fundo escuro).
//
// ABORDAGEM DEFINITIVA: usar a **Mapbox Static Images API**, que retorna UMA
// ÚNICA imagem PNG já renderizada da região (satélite), servida com CORS
// correto (é uma API pensada justamente para isso, diferente do endpoint de
// tiles). Uma imagem única buscada via fetch->blob->createImageBitmap não sofre
// da interferência do cache de tiles do Leaflet. Ainda pedimos o TRAÇADO já
// desenhado na própria imagem (overlay GeoJSON path na URL) — então mesmo que
// algo falhe ao plotar por cima, o mapa já vem com a linha laranja pronta.

import { getMapboxToken, MAP_LAYERS, type MapLayerKey } from "@/lib/map-config";

export type LatLng = { lat: number; lng: number };

const TILE = 256; // px por tile na projeção Web Mercator no zoom 0

/**
 * Projeção Web Mercator → pixel global, com zoom FRACIONÁRIO (a Static API usa
 * zoom fracionário; a projeção matemática suporta perfeitamente).
 */
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

/**
 * Escolhe o zoom FRACIONÁRIO em que o bbox (com padding) cabe no canvas WxH.
 * A Static API aceita zoom com casas decimais, então não arredondamos — o
 * traçado fica com o maior tamanho possível dentro da margem.
 */
function pickZoomFractional(path: LatLng[], w: number, h: number, paddingPx: number): number {
  const b = bounds(path);
  // Span do bbox no zoom 0 (px). Evita divisão por zero para trajetos minúsculos.
  const a0 = lngLatToPixel(b.minLat, b.minLng, 0);
  const c0 = lngLatToPixel(b.maxLat, b.maxLng, 0);
  const spanX0 = Math.max(1e-6, Math.abs(c0.x - a0.x));
  const spanY0 = Math.max(1e-6, Math.abs(c0.y - a0.y));
  const availW = Math.max(1, w - paddingPx * 2);
  const availH = Math.max(1, h - paddingPx * 2);
  // 2^z * span0 <= avail  ->  z <= log2(avail / span0). Pega o menor dos eixos.
  const zX = Math.log2(availW / spanX0);
  const zY = Math.log2(availH / spanY0);
  const z = Math.min(zX, zY);
  return Math.max(1, Math.min(19, z));
}

type Drawable = HTMLImageElement | ImageBitmap;

/**
 * Motivo do resultado do desenho do mapa, para diagnóstico visível na UI.
 * `lastMapDiag` guarda o último motivo (lido pelo export para o toast).
 */
export let lastMapDiag = "";

/**
 * Baixa uma imagem via `<img>` + objectURL (blob LOCAL nunca tainta o canvas).
 * Usamos `<img>` em vez de `createImageBitmap` porque este último, em alguns
 * WebViews/navegadores, falha silenciosamente ao decodificar JPEG da Static API
 * (a `<img>` decodifica qualquer formato que o browser exibe). O objectURL é
 * local, então o canvas NÃO fica tainted.
 */
async function loadImageEl(url: string): Promise<HTMLImageElement> {
  const res = await fetch(url, { mode: "cors", cache: "no-store", credentials: "omit" });
  if (!res.ok) throw new Error(`http ${res.status}`);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("decode"));
      img.src = objectUrl;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 8000);
  }
}

export type MapProjector = {
  /** Converte lat/lng em coordenada de pixel DENTRO do canvas (WxH). */
  project: (lat: number, lng: number) => { x: number; y: number };
  zoom: number;
};

/** Simplifica o path (Douglas-Peucker leve por amostragem) para caber na URL. */
function samplePath(path: LatLng[], maxPoints: number): LatLng[] {
  if (path.length <= maxPoints) return path;
  const step = (path.length - 1) / (maxPoints - 1);
  const out: LatLng[] = [];
  for (let i = 0; i < maxPoints; i++) out.push(path[Math.round(i * step)]);
  return out;
}

/**
 * Desenha o mapa (Static Images API do Mapbox) cobrindo o canvas WxH,
 * centralizado no trajeto. Retorna o projetor para plotar o traçado animado por
 * cima na MESMA geometria. Se não houver token ou a imagem falhar, desenha um
 * fundo neutro e retorna um projetor válido (mesmo centro/zoom) — o traçado
 * ainda aparece.
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
  const z = pickZoomFractional(path, w, h, padding);
  const b = bounds(path);
  const centerLat = (b.minLat + b.maxLat) / 2;
  const centerLng = (b.minLng + b.maxLng) / 2;

  // Origem do canvas em pixels globais (no zoom fracionário z): o centro do
  // canvas corresponde ao centro do bbox — igual ao enquadramento da Static API.
  const center = lngLatToPixel(centerLat, centerLng, z);
  const originX = center.x - w / 2;
  const originY = center.y - h / 2;
  const project = (lat: number, lng: number) => {
    const p = lngLatToPixel(lat, lng, z);
    return { x: p.x - originX, y: p.y - originY };
  };

  // Fundo neutro (fallback) sempre desenhado primeiro.
  const gbg = ctx.createLinearGradient(0, 0, 0, h);
  gbg.addColorStop(0, "#0f172a");
  gbg.addColorStop(1, "#1e293b");
  ctx.fillStyle = gbg;
  ctx.fillRect(0, 0, w, h);

  if (!token) { lastMapDiag = "sem token"; return { project, zoom: z }; }

  const style = MAP_LAYERS.find((l) => l.key === layer)?.style ?? "satellite-streets-v12";

  // A Static API limita a 1280px por lado. Pedimos na MESMA proporção do canvas
  // (para desenhar 1:1 sem distorcer) respeitando 1280 no maior lado.
  const maxSide = 1280;
  const ratio = Math.min(1, maxSide / Math.max(w, h));
  const reqW = Math.max(1, Math.round(w * ratio));
  const reqH = Math.max(1, Math.round(h * ratio));

  // Overlay GeoJSON: o TRAÇADO já renderizado na imagem pelo servidor (linha
  // laranja). Assim o mapa vem com a linha mesmo antes de plotarmos a animação.
  const geojson = {
    type: "Feature",
    properties: { stroke: "#f97316", "stroke-width": 5, "stroke-opacity": 0.9 },
    geometry: {
      type: "LineString",
      coordinates: samplePath(path, 90).map((p) => [
        Number(p.lng.toFixed(5)),
        Number(p.lat.toFixed(5)),
      ]),
    },
  };
  const overlay = `geojson(${encodeURIComponent(JSON.stringify(geojson))})`;

  // /static/{overlay}/{lon},{lat},{zoom}/{w}x{h}
  const url =
    `https://api.mapbox.com/styles/v1/mapbox/${style}/static/` +
    `${overlay}/${centerLng.toFixed(6)},${centerLat.toFixed(6)},${z.toFixed(2)}/` +
    `${reqW}x${reqH}?access_token=${token}&attribution=false&logo=false`;

  try {
    const img = await loadImageEl(url);
    // Desenha cobrindo todo o canvas (a imagem tem a mesma proporção do canvas,
    // então 0,0,w,h preenche 1:1 sem distorcer).
    ctx.drawImage(img, 0, 0, w, h);
    lastMapDiag = "ok";
  } catch (e) {
    // Sem imagem: fundo neutro já está pintado; o traçado será plotado por cima.
    lastMapDiag = "falha: " + (e instanceof Error ? e.message : String(e));
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
