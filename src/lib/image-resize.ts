/**
 * Lógica pura de cálculo de redimensionamento/compressão de imagem
 * (Requirement 11.1).
 *
 * Esta função NÃO acessa `<canvas>`, `Image`, `File` ou qualquer API de
 * navegador — opera exclusivamente sobre a abstração `{ width, height,
 * sizeBytes }`, o que a torna testável em qualquer ambiente (Node, browser,
 * CI sem DOM), seguindo o mesmo padrão de extração de lógica pura já usado
 * em `src/lib/rate-limiter.ts` e `src/lib/review-xp.ts`. A aplicação real do
 * plano retornado aqui (desenhar em `<canvas>` e exportar via `toBlob`)
 * acontece em `src/lib/api.ts`, no momento do upload (`uploadReviewPhoto`/
 * `uploadPartnerGalleryImage`).
 *
 * Modelo de estimativa: o tamanho de um arquivo JPEG/WEBP escala, em
 * primeira aproximação, de forma linear com (área em pixels) × (qualidade
 * de compressão). Para reduzir o tamanho estimado até o limite, a função
 * primeiro tenta reduzir apenas a qualidade (até um piso `MIN_QUALITY`); se
 * isso não for suficiente, o restante da redução necessária vem de encolher
 * a área, aplicando o MESMO fator de escala à largura e à altura — o que
 * preserva a proporção original exatamente (a menos do arredondamento para
 * pixel inteiro). Uma margem de segurança (`SAFETY_MARGIN`) compensa a
 * imprecisão desse modelo linear em relação à compressão real.
 */

export type ImageDimensionsInput = {
  /** Largura original da imagem, em pixels. */
  width: number;
  /** Altura original da imagem, em pixels. */
  height: number;
  /** Tamanho original do arquivo, em bytes. */
  sizeBytes: number;
};

export type ImageResizePlan = {
  /** Largura recomendada após o redimensionamento, em pixels. */
  targetWidth: number;
  /** Altura recomendada após o redimensionamento, em pixels. */
  targetHeight: number;
  /** Qualidade de compressão recomendada (0 a 1), para uso em `canvas.toBlob`/`convertToBlob`. */
  targetQuality: number;
  /**
   * `false` quando o arquivo original já está dentro do limite (ou a
   * entrada é degenerada) — nesse caso o arquivo original NÃO deve ser
   * alterado, mesmo que `targetWidth`/`targetHeight`/`targetQuality`
   * estejam preenchidos com os valores originais.
   */
  needsResize: boolean;
};

/** Limite de tamanho já validado por `uploadReviewPhoto`/`uploadPartnerGalleryImage` (5 MB). */
export const DEFAULT_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const MAX_QUALITY = 0.92;
const MIN_QUALITY = 0.5;
const MIN_DIMENSION = 1;
const SAFETY_MARGIN = 0.85;

/**
 * Calcula o plano de redimensionamento/compressão para uma imagem descrita
 * apenas por suas dimensões e tamanho em bytes.
 *
 * @param input Dimensões e tamanho originais da imagem.
 * @param maxBytes Limite de tamanho desejado para o arquivo final (padrão: 5 MB).
 * @returns O plano de redimensionamento. Quando `needsResize` é `false`, o
 *   arquivo original deve ser mantido sem alteração.
 */
export function calculateImageResizePlan(
  input: ImageDimensionsInput,
  maxBytes: number = DEFAULT_MAX_UPLOAD_BYTES,
): ImageResizePlan {
  const { width, height, sizeBytes } = input;

  const isValidInput = width > 0 && height > 0 && sizeBytes > 0 && maxBytes > 0;

  // Entrada degenerada (dimensões/tamanho inválidos): não há base segura
  // para calcular um plano — não altera o arquivo original, deixando a
  // validação de tamanho já existente decidir.
  if (!isValidInput || sizeBytes <= maxBytes) {
    return {
      targetWidth: width,
      targetHeight: height,
      targetQuality: MAX_QUALITY,
      needsResize: false,
    };
  }

  // Fator de redução total necessário (em relação à estimativa de tamanho
  // atual, já considerando a margem de segurança).
  const targetRatio = (maxBytes * SAFETY_MARGIN) / sizeBytes;

  // 1) Tenta atingir o alvo reduzindo apenas a qualidade.
  let targetQuality = MAX_QUALITY * targetRatio;
  let areaScale = 1;

  if (targetQuality < MIN_QUALITY) {
    // 2) A qualidade mínima não é suficiente isoladamente: o restante da
    // redução necessária vem de encolher a área (largura × altura),
    // aplicando o mesmo fator a ambas as dimensões para preservar a
    // proporção original.
    areaScale = targetQuality / MIN_QUALITY;
    targetQuality = MIN_QUALITY;
  }

  const dimensionScale = Math.sqrt(Math.min(1, areaScale));

  // Arredondar largura e altura de forma independente (cada uma com seu
  // próprio `Math.floor` + piso `MIN_DIMENSION`) pode quebrar a proporção
  // original: quando uma dimensão é pequena e o fator de escala é
  // agressivo, o piso de 1px aplicado a ela isoladamente não é
  // re-propagado para a outra dimensão.
  //
  // Para preservar a proporção EXATAMENTE (erro 0%, não apenas dentro da
  // tolerância), reduzimos `width`/`height` à sua forma mínima (dividindo
  // pelo `gcd`) e escalamos por um múltiplo inteiro comum `k`: qualquer
  // par `(k * baseWidth, k * baseHeight)` preserva a razão original de
  // forma exata, para qualquer `k >= 1`. Escolhemos o maior `k` que ainda
  // reduz a área na direção desejada, nunca menor que 1.
  //
  // Quando `width` e `height` são coprimos (gcd = 1) — ou, de forma mais
  // geral, quando o piso de 1 unidade já é atingido em `k` — não existe
  // nenhum par de inteiros estritamente menor que preserve a razão
  // original dentro da tolerância (ex.: 2:3 não tem nenhum par menor a
  // até 1% de erro). Nesses casos mantemos as dimensões originais em vez
  // de arredondar para um par que quebraria a proporção — um trade-off
  // aceitável já que a Property 12 prioriza a preservação da proporção
  // sobre atingir exatamente o tamanho estimado.
  const divisor = greatestCommonDivisor(width, height);
  const baseWidth = width / divisor;
  const baseHeight = height / divisor;

  const scaleUnits = Math.max(1, Math.round(divisor * dimensionScale));

  const targetWidth = Math.max(MIN_DIMENSION, scaleUnits * baseWidth);
  const targetHeight = Math.max(MIN_DIMENSION, scaleUnits * baseHeight);

  return { targetWidth, targetHeight, targetQuality, needsResize: true };
}

/** Maior divisor comum entre dois inteiros positivos (algoritmo de Euclides). */
function greatestCommonDivisor(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    [x, y] = [y, x % y];
  }
  return x || 1;
}

/**
 * Aplica o `ImageResizePlan` calculado por `calculateImageResizePlan` a um
 * `File` real do navegador, usando `<canvas>`/`toBlob` (sem dependência
 * nova — nenhuma biblioteca de imagem client-side está no `package.json`
 * atual). Usada por `uploadReviewPhoto`/`uploadPartnerGalleryImage` em
 * `src/lib/api.ts` antes do upload.
 *
 * Comportamento de fallback (Requirement 11.1 / design.md): qualquer falha
 * durante a leitura das dimensões, o redimensionamento em `<canvas>` ou a
 * exportação do blob resulta no retorno do ARQUIVO ORIGINAL, sem lançar —
 * deixando a validação de 5 MB já existente em `uploadReviewPhoto`/
 * `uploadPartnerGalleryImage` rejeitar caso o arquivo original ainda exceda
 * o limite.
 *
 * @param file Arquivo original selecionado pelo usuário.
 * @param maxBytes Limite de tamanho desejado (padrão: 5 MB, igual à
 *   validação existente nas funções de upload).
 * @returns O arquivo redimensionado/comprimido, ou o arquivo original
 *   quando já está dentro do limite ou quando o redimensionamento falha.
 */
export async function resizeImageForUpload(
  file: File,
  maxBytes: number = DEFAULT_MAX_UPLOAD_BYTES,
): Promise<File> {
  try {
    const dimensions = await readImageDimensions(file);
    const plan = calculateImageResizePlan(
      { width: dimensions.width, height: dimensions.height, sizeBytes: file.size },
      maxBytes,
    );

    if (!plan.needsResize) {
      return file;
    }

    const blob = await drawResizedBlob(dimensions.bitmapSource, plan, file.type);
    if (!blob) {
      return file;
    }

    return new File([blob], file.name, { type: blob.type || file.type });
  } catch {
    // Qualquer falha (decodificação, canvas indisponível, exportação do
    // blob) faz fallback silencioso para o arquivo original.
    return file;
  }
}

type ImageBitmapSource = ImageBitmap | HTMLImageElement;

async function readImageDimensions(
  file: File,
): Promise<{ width: number; height: number; bitmapSource: ImageBitmapSource }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return { width: bitmap.width, height: bitmap.height, bitmapSource: bitmap };
  }

  return await readImageDimensionsViaImageElement(file);
}

function readImageDimensionsViaImageElement(
  file: File,
): Promise<{ width: number; height: number; bitmapSource: ImageBitmapSource }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight, bitmapSource: img });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Falha ao decodificar imagem."));
    };
    img.src = url;
  });
}

function drawResizedBlob(
  source: ImageBitmapSource,
  plan: ImageResizePlan,
  mimeType: string,
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = plan.targetWidth;
  canvas.height = plan.targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return Promise.resolve(null);
  }
  ctx.drawImage(source, 0, 0, plan.targetWidth, plan.targetHeight);

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob),
      mimeType || "image/jpeg",
      plan.targetQuality,
    );
  });
}
