// Validação pura de vídeo da comunidade (spec video-atividade-comunidade).
//
// Estratégia (lição do Bloco B — estabilidade de memória): NÃO transcodificar
// vídeo no cliente. Em vez disso, limites claros de tipo/tamanho/duração e
// recusa com mensagem clara. As decisões aqui são puras e testáveis (sem DOM);
// a leitura da duração em si (que exige `<video>.loadedmetadata`) fica num
// helper fino não-puro no componente/api.ts, mas a DECISÃO é `validateVideoDuration`.

export const MAX_VIDEO_BYTES = 30 * 1024 * 1024; // 30 MB
export const MAX_VIDEO_DURATION_SECONDS = 60; // 60 s

// MIME → extensão. Espelha o padrão de `ALLOWED_IMAGE_TYPES` em api.ts.
export const ALLOWED_VIDEO_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export type VideoValidationReason = "type" | "size" | "duration";

export type VideoValidationResult =
  | { ok: true; ext: string }
  | { ok: false; reason: VideoValidationReason };

/**
 * Valida tipo e tamanho de um arquivo de vídeo (puro, sem DOM).
 * Total e tipado: nunca lança, sempre retorna `ok:true+ext` ou
 * `ok:false+reason`.
 *
 * Ordem determinística: tipo primeiro (extensão desconhecida é inútil), depois
 * tamanho. `maxBytes` permite override (default `MAX_VIDEO_BYTES`).
 *
 * Requirements: 2.1, 2.3, 2.4.
 */
export function validateVideoFileMeta(
  file: { type: string; size: number },
  maxBytes: number = MAX_VIDEO_BYTES,
): VideoValidationResult {
  // `hasOwnProperty` evita colisão com chaves do protótipo (ex.: "valueOf",
  // "toString") — um `ALLOWED_VIDEO_TYPES["valueOf"]` retornaria a função
  // herdada (truthy) e classificaria um tipo inválido como válido.
  const ext = Object.prototype.hasOwnProperty.call(ALLOWED_VIDEO_TYPES, file.type)
    ? ALLOWED_VIDEO_TYPES[file.type]
    : undefined;
  if (!ext) {
    return { ok: false, reason: "type" };
  }
  // size negativo/não-finito é tratado como inválido por segurança.
  if (!Number.isFinite(file.size) || file.size < 0 || file.size > maxBytes) {
    return { ok: false, reason: "size" };
  }
  return { ok: true, ext };
}

/**
 * Valida a duração já lida (puro). Duração não-finita, ≤0 ou acima do máximo
 * retorna `ok:false` (Req 2.5: indeterminável recusa por segurança).
 *
 * Requirements: 2.2, 2.5.
 */
export function validateVideoDuration(
  seconds: number,
  maxSeconds: number = MAX_VIDEO_DURATION_SECONDS,
): { ok: boolean } {
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > maxSeconds) {
    return { ok: false };
  }
  return { ok: true };
}

/**
 * Mensagem de erro amigável (pt-BR) para cada motivo de recusa. Centralizada
 * aqui para consistência entre comunidade e finish de atividade.
 */
export function videoRejectionMessage(reason: VideoValidationReason): string {
  switch (reason) {
    case "type":
      return "Formato de vídeo inválido. Use MP4, WebM ou MOV.";
    case "size":
      return "Vídeo muito grande (máx. 30 MB).";
    case "duration":
      return "Vídeo muito longo (máx. 60 segundos).";
  }
}
