import { useEffect, useRef, useState } from "react";
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
 * SafeVideo — player de vídeo com autoplay no feed, preservando a disciplina
 * de memória (spec video-atividade-comunidade + ajuste do usuário: autoplay).
 *
 * Autoplay estilo feed (Instagram/TikTok), sem estourar memória:
 * - `muted` + `playsInline`: exigência dos navegadores/WebView para permitir
 *   autoplay (autoplay com som é bloqueado). O usuário liga o som pelos
 *   controles se quiser.
 * - Um `IntersectionObserver` toca APENAS o vídeo visível na viewport e pausa
 *   ao sair — nunca todos ao mesmo tempo (mantém o objetivo do Bloco B).
 * - `preload="metadata"`: carrega só o cabeçalho até entrar em cena; ao ficar
 *   visível, o play dispara o carregamento do restante. Fora da tela, some.
 * - `loop` para o vídeo curto reiniciar enquanto está visível.
 * - `poster` nativo + fallback via `SafeImage` sem loop de erro (Req 4.3/4.5).
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
  /** Liga o autoplay ao entrar na viewport (default true). */
  autoPlayInView?: boolean;
}

export function SafeVideo({
  src,
  posterSrc,
  className,
  aspectClassName = "aspect-[4/5]",
  ariaLabel,
  autoPlayInView = true,
}: SafeVideoProps) {
  const [didFail, setDidFail] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const handleError = () => {
    setDidFail((prev) => nextVideoStateOnError({ didFail: prev }).didFail);
  };

  // Autoplay controlado por visibilidade: toca só quando ≥ 60% do vídeo está
  // na tela; pausa (e volta ao início) ao sair. Garante 1 vídeo tocando por
  // vez conforme o usuário rola, sem decodificar os demais.
  useEffect(() => {
    if (!autoPlayInView) return;
    const el = videoRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            // play() pode rejeitar (ex.: política do navegador) — ignorado.
            void el.play().catch(() => {});
          } else {
            el.pause();
          }
        }
      },
      { threshold: [0, 0.6] },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [autoPlayInView, src]);

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
        ref={videoRef}
        src={src}
        poster={posterSrc}
        preload="metadata"
        controls
        muted
        loop
        playsInline
        aria-label={ariaLabel ?? "Vídeo da publicação"}
        onError={handleError}
        className="h-full w-full object-cover"
      />
    </div>
  );
}
