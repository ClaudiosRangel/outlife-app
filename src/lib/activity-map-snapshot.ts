// Geração client-side do Activity_Map_Snapshot: uma imagem estática do
// trajeto percorrido por uma User_Activity, persistida no momento em que
// essa User_Activity é finalizada.
//
// Requirement 6.1: quando uma User_Activity é finalizada com um trajeto
// válido (mínimo 2 pontos de localização registrados), a OutLife_Application
// deve gerar um Activity_Map_Snapshot desse trajeto.
//
// A lógica visual replica exatamente `src/components/ActivityMap.tsx`
// (mesma fonte de tiles OSM, mesma cor/espessura/opacidade da polyline),
// mas desenhada num `<canvas>` offscreen em vez de um `L.Map` do Leaflet —
// não há dependência de Leaflet aqui, apenas a matemática de projeção
// Web Mercator equivalente à usada internamente por ele.
//
// Esta função só pode ser chamada em ambiente de navegador (usa `document`,
// `<canvas>` e `new Image()`). A chamada em `atividade.rastrear.tsx` (task
// 7.3) envolve esta função num `try/catch` isolado: qualquer falha aqui
// (tile que não carrega, canvas "tainted" por CORS, ausência de contexto
// 2D) deve propagar como exceção para esse `catch`, nunca ser engolida
// internamente — assim a finalização da atividade prossegue sem o
// snapshot (Requirement 6.3), sem exigir que esta função conheça esse
// comportamento de fallback.

/** Um ponto de localização do trajeto, no mesmo formato usado por `ActivityMap.tsx`. */
export interface MapSnapshotPoint {
  lat: number;
  lng: number;
}

export interface GenerateActivityMapSnapshotOptions {
  /** Largura da imagem gerada, em pixels. Padrão: 600. */
  width?: number;
  /** Altura da imagem gerada, em pixels. Padrão: 400. */
  height?: number;
  /**
   * Margem interna (em pixels) mantida entre o trajeto e a borda da
   * imagem ao calcular o zoom que melhor enquadra o trajeto — equivalente
   * ao `padding: [24, 24]` usado por `map.fitBounds` em `ActivityMap.tsx`.
   * Padrão: 24.
   */
  paddingPx?: number;
  /** Qualidade de compressão WebP (0 a 1) passada a `canvas.toBlob`. Padrão: 0.85. */
  quality?: number;
}

/** Template de URL dos tiles OSM, idêntico ao usado em `ActivityMap.tsx`. */
const OSM_TILE_URL_TEMPLATE = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

/** Tamanho padrão (em pixels) de um tile do OSM. */
const TILE_SIZE = 256;

/** Zoom máximo tentado ao enquadrar o trajeto (limite prático dos tiles OSM). */
const MAX_ZOOM = 18;

/** Zoom mínimo tentado ao enquadrar o trajeto. */
const MIN_ZOOM = 0;

/** Cor da polyline do trajeto, idêntica a `pathOptions.color` em `ActivityMap.tsx`. */
const POLYLINE_COLOR = "#16a34a";

/** Espessura da polyline, idêntica a `pathOptions.weight` em `ActivityMap.tsx`. */
const POLYLINE_WEIGHT = 5;

/** Opacidade da polyline, idêntica a `pathOptions.opacity` em `ActivityMap.tsx`. */
const POLYLINE_OPACITY = 0.85;

const DEFAULT_WIDTH = 600;
const DEFAULT_HEIGHT = 400;
const DEFAULT_PADDING_PX = 24;
const DEFAULT_QUALITY = 0.85;

/**
 * Gera o Activity_Map_Snapshot de um trajeto: um `<canvas>` offscreen com
 * os tiles OSM correspondentes à área do trajeto e a polyline do percurso
 * desenhada por cima, exportado como WebP.
 *
 * @param points Pontos de localização do trajeto, na ordem capturada.
 * @param options Dimensões/qualidade da imagem gerada (ver defaults acima).
 * @returns `null` se `points.length < 2` (trajeto inválido para snapshot,
 *   Requirement 6.1); caso contrário, o `Blob` WebP gerado (ou `null` se
 *   `canvas.toBlob` não conseguir produzir um blob, o que o `try/catch` do
 *   chamador também trata como "sem snapshot").
 */
export async function generateActivityMapSnapshot(
  points: MapSnapshotPoint[],
  options: GenerateActivityMapSnapshotOptions = {},
): Promise<Blob | null> {
  if (points.length < 2) return null;

  const width = options.width ?? DEFAULT_WIDTH;
  const height = options.height ?? DEFAULT_HEIGHT;
  const paddingPx = options.paddingPx ?? DEFAULT_PADDING_PX;
  const quality = options.quality ?? DEFAULT_QUALITY;

  const bounds = computeBounds(points);

  // Área útil disponível para o trajeto em si, descontada a margem
  // interna — equivalente ao `padding` do `fitBounds` do Leaflet.
  const usableWidth = Math.max(1, width - paddingPx * 2);
  const usableHeight = Math.max(1, height - paddingPx * 2);
  const zoom = computeFitZoom(bounds, usableWidth, usableHeight);

  // Centro geográfico do bounding box, projetado para pixels no zoom
  // escolhido, define o canto superior-esquerdo (origem) do viewport do
  // canvas — o mesmo efeito visual de `map.fitBounds` centralizando o
  // trajeto na área visível.
  const centerLat = (bounds.minLat + bounds.maxLat) / 2;
  const centerLng = (bounds.minLng + bounds.maxLng) / 2;
  const centerPixel = project(centerLat, centerLng, zoom);
  const originX = centerPixel.x - width / 2;
  const originY = centerPixel.y - height / 2;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Contexto 2D do canvas indisponível para gerar o Activity_Map_Snapshot.");
  }

  await drawOsmTiles(ctx, originX, originY, width, height, zoom);
  drawTrackPolyline(ctx, points, originX, originY, zoom);

  return canvasToWebpBlob(canvas, quality);
}

interface LatLngBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/** Bounding box (WGS84) que contém todos os pontos do trajeto. */
function computeBounds(points: MapSnapshotPoint[]): LatLngBounds {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const point of points) {
    if (point.lat < minLat) minLat = point.lat;
    if (point.lat > maxLat) maxLat = point.lat;
    if (point.lng < minLng) minLng = point.lng;
    if (point.lng > maxLng) maxLng = point.lng;
  }

  return { minLat, maxLat, minLng, maxLng };
}

/**
 * Projeta uma coordenada WGS84 para pixels no espaço de tiles Web
 * Mercator (mesma projeção usada pelo OSM/Leaflet), num dado zoom — a
 * escala do "mundo" em pixels é `TILE_SIZE * 2^zoom`.
 */
function project(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const scale = TILE_SIZE * 2 ** zoom;
  const x = ((lng + 180) / 360) * scale;
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
  return { x, y };
}

/**
 * Encontra o maior zoom (entre `MIN_ZOOM` e `MAX_ZOOM`) no qual o
 * bounding box do trajeto, projetado em pixels, ainda cabe dentro da área
 * útil disponível — equivalente ao que `map.fitBounds` calcula
 * internamente no Leaflet.
 */
function computeFitZoom(bounds: LatLngBounds, usableWidth: number, usableHeight: number): number {
  for (let zoom = MAX_ZOOM; zoom >= MIN_ZOOM; zoom--) {
    const topLeft = project(bounds.maxLat, bounds.minLng, zoom);
    const bottomRight = project(bounds.minLat, bounds.maxLng, zoom);
    const bboxWidth = bottomRight.x - topLeft.x;
    const bboxHeight = bottomRight.y - topLeft.y;

    if (bboxWidth <= usableWidth && bboxHeight <= usableHeight) {
      return zoom;
    }
  }

  return MIN_ZOOM;
}

/**
 * Carrega e desenha, num `<canvas>` offscreen, todos os tiles OSM que
 * cobrem o viewport `[originX, originY, width, height]` (em pixels do
 * espaço de projeção) no zoom indicado.
 */
async function drawOsmTiles(
  ctx: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  width: number,
  height: number,
  zoom: number,
): Promise<void> {
  const tileCountAtZoom = 2 ** zoom;
  const firstTileX = Math.floor(originX / TILE_SIZE);
  const firstTileY = Math.floor(originY / TILE_SIZE);
  const lastTileX = Math.floor((originX + width) / TILE_SIZE);
  const lastTileY = Math.floor((originY + height) / TILE_SIZE);

  const tileLoads: Promise<void>[] = [];

  for (let tileX = firstTileX; tileX <= lastTileX; tileX++) {
    for (let tileY = firstTileY; tileY <= lastTileY; tileY++) {
      // O eixo Y (latitude) da projeção Mercator não dá "wrap" — tiles
      // fora de [0, tileCountAtZoom) simplesmente não existem.
      if (tileY < 0 || tileY >= tileCountAtZoom) continue;

      // O eixo X (longitude) dá wrap ao redor do globo, relevante para
      // trajetos próximos ao antimeridiano.
      const wrappedTileX = ((tileX % tileCountAtZoom) + tileCountAtZoom) % tileCountAtZoom;

      const drawX = tileX * TILE_SIZE - originX;
      const drawY = tileY * TILE_SIZE - originY;

      tileLoads.push(
        loadTileImage(zoom, wrappedTileX, tileY).then((image) => {
          ctx.drawImage(image, drawX, drawY, TILE_SIZE, TILE_SIZE);
        }),
      );
    }
  }

  await Promise.all(tileLoads);
}

/** Carrega um único tile OSM como `HTMLImageElement`, via `new Image()`. */
function loadTileImage(zoom: number, x: number, y: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Falha ao carregar tile OSM z=${zoom} x=${x} y=${y}.`));
    image.src = OSM_TILE_URL_TEMPLATE.replace("{z}", String(zoom))
      .replace("{x}", String(x))
      .replace("{y}", String(y));
  });
}

/**
 * Desenha a polyline do trajeto sobre os tiles já desenhados, com a mesma
 * cor/espessura/opacidade usadas por `ActivityMap.tsx`.
 */
function drawTrackPolyline(
  ctx: CanvasRenderingContext2D,
  points: MapSnapshotPoint[],
  originX: number,
  originY: number,
  zoom: number,
): void {
  ctx.save();
  ctx.globalAlpha = POLYLINE_OPACITY;
  ctx.strokeStyle = POLYLINE_COLOR;
  ctx.lineWidth = POLYLINE_WEIGHT;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  points.forEach((point, index) => {
    const pixel = project(point.lat, point.lng, zoom);
    const x = pixel.x - originX;
    const y = pixel.y - originY;
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();

  ctx.restore();
}

/** Exporta o canvas como WebP via `canvas.toBlob`, envolvido numa Promise. */
function canvasToWebpBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => resolve(blob), "image/webp", quality);
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
