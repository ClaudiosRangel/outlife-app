import { useState } from "react";
import { cn } from "@/lib/utils";
import { SafeImage } from "@/components/SafeImage";

/**
 * Decisão pura de estado do SafeVideo em erro de carregamento (Property 6):
 * quando o vídeo falha ao carregar, cai para exibir o poster/fallback uma
 * única vez, sem loop. Extraída como função pura para ser testável sem
 * renderizar (o projeto não tem testing-library/jsdom).
 *
 * `didFail` guarda que já ocorreu a queda para poster, evitando reprocessar.
 */
export function nextVideoStateOnError(params: {
  didFail: boolean;
}): { showPosterFallback: boolean; didFail: boolean } {
  if (!params.didFail) {
    return { showPosterFallback: true, didFail: true };
  }
  return { showPosterFallback: true, didFail: true };
}

/**
 * SafeVideo — player de vídeo com disciplina de memória (spec
 * video-atividade-comunidade). Análogo ao `SafeImage`.
 *
 * Regras de estabilidade (Bloco B amplificado por vídeo):
 * - `preload="none"` e SEM `autoplay`: o vídeo só é buscado/decodificado
 *   quando o usuário toca em play (Req 4.1/4.2). No scroll do feed, apenas o
 *   poster (imagem leve) é exibido.
 * - `poster` nativo + fallback via `SafeImage` (container de dimensão fixa),
 *   se o vídeo falhar ao carregar, sem loop de erro (Req 4.3/4.5).
 * - `playsInline` para não abrir o player de tela cheia no iOS ao dar play.
 */
export interface SafeVideoProps {
  src: string;
  /** Video_Poster — imagem do post exibida antes do play (Req 4.3). */
  posterSrc?: string;
  className?: string;
  /** Proporção do container (o cap visual). */
  aspectClassName?: string;
  /** Rótulo acessível. */
  ariaLabel?: string;
}

export function SafeVideo({
  src,
  posterSrc,
  className,
  aspectClassName = "aspect-[4/5]",
  ariaLabel,
}: SafeVideoProps) {
  const [didFail, setDidFail] = useState(false);

  const handleError = () => {
    setDidFail((prev) => nextVideoStateOnError({ didFail: prev }).didFail);
  };

  // Se o vídeo falhou e há poster, mostra só o poster (imagem segura).
  if (didFail && posterSrc) {
    return (
      <SafeImage
        src={posterSrc}
        alt={ariaLabel ?? "Prévia do vídeo"}
        className={className}
        aspectClassName={aspectClassName}
      />
    );
  }

  return (
    <div className={cn("relative overflow-hidden", aspectClassName, className)}>
      <video
        src={src}
        poster={posterSrc}
        preload="none"
        controls
        playsInline
        aria-label={ariaLabel ?? "Vídeo da publicação"}
        onError={handleError}
        className="h-full w-full object-cover"
      />
    </div>
  );
}
