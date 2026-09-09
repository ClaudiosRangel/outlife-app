import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import logoOutvitar from "@/assets/logo-outvitar.png";

/**
 * BrandLogo — marca OutVitar centralizada (spec rebranding-outvitar).
 *
 * Exibe o símbolo da logo (quando o asset existe) + wordmark "OutVitar".
 * Se a imagem falhar ao carregar, cai para o wordmark textual (Req 3.2); se
 * nem o texto estiver disponível, o container fica vazio sem quebrar o layout
 * (Req 3.3).
 *
 * A logo oficial vive em `src/assets/logo-outvitar.png` (montanha + sol +
 * trilha no pin). O import resolve para a URL do asset empacotado pelo Vite;
 * se o arquivo não existir no build, o `onError` cai para o wordmark textual.
 */

const logoSrc: string | undefined = logoOutvitar;

/**
 * Decisão pura de exibição do símbolo (Property 3): dado o estado de erro da
 * imagem e a disponibilidade do asset, retorna se o símbolo deve ser
 * renderizado. Extraída para ser testável sem DOM.
 */
export function shouldShowLogoSymbol(params: {
  hasAsset: boolean;
  imageErrored: boolean;
}): boolean {
  return params.hasAsset && !params.imageErrored;
}

export interface BrandLogoProps {
  /** Altura do símbolo em px (largura proporcional). */
  size?: number;
  /** Classe do wordmark (ex.: "text-white" no hero). */
  className?: string;
  /** Exibe o nome ao lado do símbolo (default true). */
  withWordmark?: boolean;
  /**
   * Aplica sombra ao wordmark e ao símbolo para garantir legibilidade quando
   * a marca é exibida sobre uma foto/gradiente (ex.: hero da Home). Padrão de
   * mercado (Strava/AllTrails) para wordmark branco sobre imagem.
   */
  onImage?: boolean;
}

export function BrandLogo({
  size = 24,
  className,
  withWordmark = true,
  onImage = false,
}: BrandLogoProps) {
  const { t } = useTranslation();
  const [imageErrored, setImageErrored] = useState(false);
  const name = t("brand.name", "OutVitar");
  const showSymbol = shouldShowLogoSymbol({ hasAsset: logoSrc != null, imageErrored });

  // Sombra sutil para contraste sobre foto (não afeta uso sobre fundo sólido).
  const imageShadow = onImage
    ? "drop-shadow(0 1px 3px rgba(0,0,0,0.55)) drop-shadow(0 0 1px rgba(0,0,0,0.4))"
    : undefined;

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {showSymbol && (
        <img
          src={logoSrc}
          alt={name}
          height={size}
          style={{ height: size, width: "auto", filter: imageShadow }}
          onError={() => setImageErrored(true)}
          className="object-contain"
        />
      )}
      {withWordmark && (
        <span
          className="font-display font-semibold tracking-tight"
          style={{ fontSize: size * 0.85, textShadow: onImage ? "0 1px 4px rgba(0,0,0,0.55)" : undefined }}
        >
          {name}
        </span>
      )}
    </span>
  );
}
