import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Decisão pura de fallback de imagem (Property 4): retorna a próxima `src` a
 * exibir quando ocorre um erro de carregamento. Aplica o fallback no máximo
 * uma vez — se já houve fallback, ou não há `fallbackSrc`, ou o fallback é
 * igual à src atual, mantém a src atual (evita loop de onError).
 *
 * Extraída como função pura para ser testável sem renderizar o componente
 * (o projeto não tem testing-library/jsdom configurado).
 */
export function nextImageSrcOnError(params: {
  currentSrc: string;
  fallbackSrc?: string;
  didFallback: boolean;
}): { src: string; didFallback: boolean } {
  const { currentSrc, fallbackSrc, didFallback } = params;
  if (!didFallback && fallbackSrc && fallbackSrc !== currentSrc) {
    return { src: fallbackSrc, didFallback: true };
  }
  return { src: currentSrc, didFallback };
}

/**
 * SafeImage — exibição de imagem com teto prático de decodificação para
 * evitar estouro de memória do WebView (spec estabilidade-comunidade-midia).
 *
 * Usa atributos nativos seguros (`decoding="async"`, `loading="lazy"`) e um
 * container de dimensão fixa (o "cap" visual), limitando o custo de memória
 * por imagem sem depender de transformação de imagem no servidor. Em erro de
 * carregamento, troca para `fallbackSrc` uma única vez (sem loop).
 *
 * Não altera o arquivo persistido — o teto aplica-se apenas à exibição no
 * cliente (Requirement 2.4).
 */
export interface SafeImageProps {
  src: string;
  alt: string;
  /** Classe do container que define a caixa de exibição (o cap visual). */
  className?: string;
  /** Classe de proporção do container (ex.: "aspect-[4/5]"). */
  aspectClassName?: string;
  /** Imagem exibida se `src` falhar ao carregar. */
  fallbackSrc?: string;
  /** Torna a imagem clicável (ex.: abrir detalhe da atividade). */
  onClick?: () => void;
  /** Rótulo acessível quando clicável. */
  ariaLabel?: string;
}

export function SafeImage({
  src,
  alt,
  className,
  aspectClassName = "aspect-[4/5]",
  fallbackSrc,
  onClick,
  ariaLabel,
}: SafeImageProps) {
  // `erroredRef`-like via estado: garante que o fallback é aplicado no
  // máximo uma vez, evitando loop de onError caso o fallback também falhe
  // (Requirement 4.2 / Property 4).
  const [currentSrc, setCurrentSrc] = useState(src);
  const [didFallback, setDidFallback] = useState(false);

  const handleError = () => {
    const next = nextImageSrcOnError({ currentSrc, fallbackSrc, didFallback });
    if (next.src !== currentSrc) {
      setCurrentSrc(next.src);
      setDidFallback(next.didFallback);
    }
  };

  const img = (
    <img
      src={currentSrc}
      alt={alt}
      decoding="async"
      loading="lazy"
      onError={handleError}
      className="h-full w-full object-cover"
    />
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel ?? alt}
        className={cn("relative block w-full", aspectClassName, className)}
      >
        {img}
      </button>
    );
  }

  return <div className={cn("relative", aspectClassName, className)}>{img}</div>;
}
