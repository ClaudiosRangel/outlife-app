// Geração client-side de Share_Banner_Image para User_Activity e
// Community_Post — o Banner_Generator.
//
// Requirement 7.2: ao selecionar a ação de compartilhar na
// Activity_Detail_Screen, a composição do Share_Banner_Image deve ocorrer
// por renderização client-side, combinando o Activity_Map_Snapshot (quando
// disponível), a distância, a duração e o Average_Pace/Average_Speed dessa
// User_Activity, completando em até 5 segundos.
// Requirement 7.3: quando a User_Activity não possuir Activity_Map_Snapshot
// registrado, o Share_Banner_Image deve ser composto apenas com as
// métricas disponíveis, omitindo a camada de mapa (nunca lançando erro por
// esse motivo).
// Requirement 7.7: falha na geração do banner de atividade — por erro de
// renderização ou por exceder o limite de 5 segundos — nunca deve resultar
// em compartilhamento de uma imagem incompleta ou corrompida: deve
// propagar como exceção, permitindo nova tentativa.
// Requirement 10.2: o Share_Banner_Image de um Community_Post combina a
// foto da publicação, o rótulo do Community_Post_Category e o texto da
// publicação, truncado em 200 caracteres com reticências quando exceder
// esse limite.
// Requirement 10.4: mesmo comportamento de falha do Requirement 7.7, com
// limite de 10 segundos para o Community_Post.
// Requirement 10.5: quando o Community_Post não possuir foto associada, o
// Share_Banner_Image usa uma imagem de fundo padrão em vez de bloquear a
// geração do banner.
//
// A composição replica o padrão já usado em `activity-map-snapshot.ts`: um
// `<canvas>` offscreen, imagens carregadas via `new Image()` com
// `crossOrigin = "anonymous"`, e exportação via `canvas.toBlob`. Assim como
// naquele módulo, uma imagem de fundo *presente* que falha ao carregar
// (tile/foto corrompida, CORS, etc.) propaga como exceção — não é
// silenciosamente ignorada aqui, pois só a *ausência* do dado
// (`mapSnapshotUrl`/`photoUrl` nulo) é um caso previsto de fallback
// (Requirements 7.3/10.5). Ambas as funções públicas compartilham o helper
// `withRenderTimeout`, que rejeita com o erro tipado `BannerTimeoutError`
// quando o prazo é excedido — distinto de um erro de renderização
// genérico, usado pela UI para decidir a mensagem exibida (embora, em
// ambos os casos, o comportamento seja "erro + permitir tentar novamente,
// nunca compartilhar algo incompleto").

export type ActivityBannerInput = {
  mapSnapshotUrl?: string | null;
  distanceMeters: number;
  durationSeconds: number;
  averagePaceLabel?: string | null; // já formatado "mm:ss/km" ou null
  averageSpeedLabel: string; // já formatado "xx.x km/h"
};

export type PostBannerInput = {
  photoUrl?: string | null; // null -> usa imagem de fundo padrão
  categoryLabel: string;
  text: string; // truncamento em 200 chars é feito aqui
};

/** Timeout padrão do banner de atividade, em ms (Requirements 7.2/7.7). */
const ACTIVITY_BANNER_TIMEOUT_MS = 5_000;

/** Timeout padrão do banner de publicação, em ms (Requirements 10.2/10.4). */
const POST_BANNER_TIMEOUT_MS = 10_000;

/** Dimensões do Share_Banner_Image gerado, em pixels (proporção 4:5, adequada a feed/stories). */
const BANNER_WIDTH = 1080;
const BANNER_HEIGHT = 1350;

/** Qualidade de compressão WebP passada a `canvas.toBlob`. */
const BANNER_QUALITY = 0.9;

/** Cor de fundo usada quando não há mapa (atividade) ou foto (post) disponível. */
const FALLBACK_BACKGROUND_COLOR = "#0f172a"; // slate-900
/** Camada semitransparente sobre a imagem de fundo, para legibilidade do texto. */
const OVERLAY_COLOR = "rgba(15, 23, 42, 0.55)";
const TEXT_COLOR = "#f8fafc";
/** Mesma cor da polyline em `activity-map-snapshot.ts`, usada como destaque. */
const ACCENT_COLOR = "#16a34a";

const PADDING_X = 72;

/**
 * Erro tipado lançado quando a composição do Share_Banner_Image excede o
 * tempo máximo permitido (Requirements 7.2/7.7, 10.2/10.4) — distinto de um
 * erro de renderização genérico, para a UI chamadora decidir a mensagem
 * exibida ao usuário.
 */
export class BannerTimeoutError extends Error {
  constructor(ms: number) {
    super(`Geração do Share_Banner_Image excedeu o limite de ${ms}ms.`);
    this.name = "BannerTimeoutError";
  }
}

/**
 * Corta `text` em `maxLength` caracteres, acrescentando "…" quando o
 * texto original exceder o limite (Requirement 10.2). Função pura,
 * isolada e testável.
 */
export function truncateForBanner(text: string, maxLength = 200): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}

/**
 * Corre `promise` contra um temporizador de `ms` milissegundos: resolve ou
 * rejeita com o desfecho de `promise` se ela concluir primeiro, ou rejeita
 * com `BannerTimeoutError` se o prazo for excedido primeiro. Compartilhado
 * por `generateActivityBanner`/`generatePostBanner` (Requirements 7.2/7.7,
 * 10.2/10.4).
 */
function withRenderTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new BannerTimeoutError(ms)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      });
  });
}

/** Carrega uma imagem via `new Image()`, rejeitando em caso de erro de carregamento. */
function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Falha ao carregar imagem do Share_Banner_Image: ${url}`));
    image.src = url;
  });
}

/** Cria o `<canvas>` offscreen padrão usado pelas duas composições de banner. */
function createBannerCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = BANNER_WIDTH;
  canvas.height = BANNER_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Contexto 2D do canvas indisponível para gerar o Share_Banner_Image.");
  }
  return { canvas, ctx };
}

/** Desenha `image` ocupando todo o canvas, recortada ("cover") mantendo proporção. */
function drawBackgroundImageCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement): void {
  const canvasRatio = BANNER_WIDTH / BANNER_HEIGHT;
  const imageRatio = image.width / image.height;

  let drawWidth: number;
  let drawHeight: number;
  let offsetX = 0;
  let offsetY = 0;

  if (imageRatio > canvasRatio) {
    drawHeight = BANNER_HEIGHT;
    drawWidth = drawHeight * imageRatio;
    offsetX = (BANNER_WIDTH - drawWidth) / 2;
  } else {
    drawWidth = BANNER_WIDTH;
    drawHeight = drawWidth / imageRatio;
    offsetY = (BANNER_HEIGHT - drawHeight) / 2;
  }

  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
}

/** Preenche o canvas inteiro com a cor de fundo padrão (fallback sem mapa/foto). */
function drawFallbackBackground(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = FALLBACK_BACKGROUND_COLOR;
  ctx.fillRect(0, 0, BANNER_WIDTH, BANNER_HEIGHT);
}

/** Escurece a imagem de fundo com uma camada semitransparente, para legibilidade do texto. */
function drawOverlay(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = OVERLAY_COLOR;
  ctx.fillRect(0, 0, BANNER_WIDTH, BANNER_HEIGHT);
}

/** Formata a distância em metros como "x.xx km". */
function formatDistanceKm(distanceMeters: number): string {
  return `${(distanceMeters / 1000).toFixed(2)} km`;
}

/** Formata a duração em segundos como "mm:ss" (< 1h) ou "h:mm:ss" (>= 1h). */
function formatDuration(durationSeconds: number): string {
  const totalSeconds = Math.max(0, Math.round(durationSeconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Quebra `text` em linhas que não excedem `maxWidth` (na fonte atual de `ctx`), por palavra. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (currentLine && ctx.measureText(candidate).width > maxWidth) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = candidate;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines;
}

/** Exporta o canvas como WebP via `canvas.toBlob`, rejeitando se `toBlob` não produzir um blob (Requirement 7.7). */
function canvasToBlobOrThrow(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Falha ao exportar o Share_Banner_Image: canvas.toBlob retornou null."));
            return;
          }
          resolve(blob);
        },
        "image/webp",
        BANNER_QUALITY,
      );
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

/**
 * Desenha as camadas de texto de um banner de atividade: distância,
 * duração e Average_Speed sempre, e o Average_Pace quando disponível
 * (Requirement 7.2 — inclui todas as camadas de métricas disponíveis).
 */
function drawActivityMetricsText(ctx: CanvasRenderingContext2D, input: ActivityBannerInput): void {
  let y = BANNER_HEIGHT - 400;

  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = TEXT_COLOR;
  ctx.font = "700 96px sans-serif";
  ctx.fillText(formatDistanceKm(input.distanceMeters), PADDING_X, y);

  y += 88;
  ctx.fillStyle = ACCENT_COLOR;
  ctx.font = "500 56px sans-serif";
  ctx.fillText(formatDuration(input.durationSeconds), PADDING_X, y);

  y += 72;
  ctx.fillStyle = TEXT_COLOR;
  ctx.font = "500 56px sans-serif";
  ctx.fillText(input.averageSpeedLabel, PADDING_X, y);

  if (input.averagePaceLabel) {
    y += 72;
    ctx.fillText(input.averagePaceLabel, PADDING_X, y);
  }
}

/**
 * Desenha as camadas de texto de um banner de publicação: rótulo da
 * Community_Post_Category e o texto truncado em 200 caracteres
 * (Requirement 10.2).
 */
function drawPostText(ctx: CanvasRenderingContext2D, input: PostBannerInput): void {
  const maxTextWidth = BANNER_WIDTH - PADDING_X * 2;
  let y = BANNER_HEIGHT - 440;

  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = ACCENT_COLOR;
  ctx.font = "700 48px sans-serif";
  ctx.fillText(input.categoryLabel.toUpperCase(), PADDING_X, y);

  y += 76;
  ctx.fillStyle = TEXT_COLOR;
  ctx.font = "500 48px sans-serif";
  const truncatedText = truncateForBanner(input.text);
  for (const line of wrapText(ctx, truncatedText, maxTextWidth)) {
    ctx.fillText(line, PADDING_X, y);
    y += 60;
  }
}

/**
 * Composição efetiva do banner de atividade (sem o timeout, aplicado por
 * `generateActivityBanner`): carrega o Activity_Map_Snapshot como fundo
 * quando presente (Requirement 7.2), ou usa o fundo padrão quando ausente
 * (Requirement 7.3 — nunca lança erro por essa ausência), desenha a camada
 * de métricas por cima, e exporta o resultado.
 */
async function renderActivityBanner(input: ActivityBannerInput): Promise<Blob> {
  const { canvas, ctx } = createBannerCanvas();

  if (input.mapSnapshotUrl) {
    const mapImage = await loadImageElement(input.mapSnapshotUrl);
    drawBackgroundImageCover(ctx, mapImage);
  } else {
    drawFallbackBackground(ctx);
  }

  drawOverlay(ctx);
  drawActivityMetricsText(ctx, input);

  return canvasToBlobOrThrow(canvas);
}

/**
 * Composição efetiva do banner de publicação (sem o timeout, aplicado por
 * `generatePostBanner`): carrega a foto do Community_Post como fundo
 * quando presente, ou usa a imagem de fundo padrão quando ausente
 * (Requirement 10.5 — nunca impede a geração do banner), desenha a
 * categoria e o texto truncado por cima, e exporta o resultado.
 */
async function renderPostBanner(input: PostBannerInput): Promise<Blob> {
  const { canvas, ctx } = createBannerCanvas();

  if (input.photoUrl) {
    const photoImage = await loadImageElement(input.photoUrl);
    drawBackgroundImageCover(ctx, photoImage);
  } else {
    drawFallbackBackground(ctx);
  }

  drawOverlay(ctx);
  drawPostText(ctx, input);

  return canvasToBlobOrThrow(canvas);
}

/**
 * Gera o Share_Banner_Image de uma User_Activity, combinando o
 * Activity_Map_Snapshot (quando disponível), a distância, a duração e o
 * Average_Pace/Average_Speed, por renderização client-side em `<canvas>`.
 *
 * Rejeita com `BannerTimeoutError` se exceder `opts.timeoutMs` (padrão
 * 5000ms, Requirement 7.2), ou com um erro de renderização genérico em
 * caso de falha no carregamento de imagem, ausência de contexto 2D, ou
 * `canvas.toBlob` não produzir um blob — nunca resolve com um `Blob`
 * incompleto (Requirement 7.7).
 */
export async function generateActivityBanner(
  input: ActivityBannerInput,
  opts?: { timeoutMs?: number },
): Promise<Blob> {
  const timeoutMs = opts?.timeoutMs ?? ACTIVITY_BANNER_TIMEOUT_MS;
  return withRenderTimeout(renderActivityBanner(input), timeoutMs);
}

/**
 * Gera o Share_Banner_Image de um Community_Post, combinando a foto da
 * publicação (ou uma imagem de fundo padrão quando ausente, Requirement
 * 10.5), o rótulo da Community_Post_Category e o texto da publicação
 * truncado em 200 caracteres (Requirement 10.2), por renderização
 * client-side em `<canvas>`.
 *
 * Rejeita com `BannerTimeoutError` se exceder `opts.timeoutMs` (padrão
 * 10000ms, Requirement 10.2), ou com um erro de renderização genérico nos
 * mesmos casos descritos em `generateActivityBanner` — nunca resolve com
 * um `Blob` incompleto (Requirement 10.4).
 */
export async function generatePostBanner(
  input: PostBannerInput,
  opts?: { timeoutMs?: number },
): Promise<Blob> {
  const timeoutMs = opts?.timeoutMs ?? POST_BANNER_TIMEOUT_MS;
  return withRenderTimeout(renderPostBanner(input), timeoutMs);
}
