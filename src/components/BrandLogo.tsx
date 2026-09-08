import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/**
 * BrandLogo — marca OutVitar centralizada (spec rebranding-outvitar).
 *
 * Exibe o símbolo da logo (quando o asset existe) + wordmark "OutVitar".
 * Se a imagem falhar ao carregar, cai para o wordmark textual (Req 3.2); se
 * nem o texto estiver disponível, o container fica vazio sem quebrar o layout
 * (Req 3.3).
 *
 * O asset da logo (`assets/logo-outvitar.png`) é um pré-requisito fornecido
 * pelo usuário; enquanto não existir, `logoSrc` é undefined e o componente
 * mostra apenas o wordmark textual — que já é a identidade correta.
 */

// O import do asset é opcional: quando o arquivo não existe, mantemos
// `logoSrc` undefined e exibimos só o wordmark. Trocar por
// `import logoOutvitar from "@/assets/logo-outvitar.png"` quando o arquivo
// for adicionado (tarefa 6 / pré-requisito de assets).
const logoSrc: string | undefined = undefined;

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
}

export function BrandLogo({ size = 24, className, withWordmark = true }: BrandLogoProps) {
  const { t } = useTranslation();
  const [imageErrored, setImageErrored] = useState(false);
  const name = t("brand.name", "OutVitar");
  const showSymbol = shouldShowLogoSymbol({ hasAsset: logoSrc != null, imageErrored });

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {showSymbol && (
        <img
          src={logoSrc}
          alt={name}
          height={size}
          style={{ height: size, width: "auto" }}
          onError={() => setImageErrored(true)}
          className="object-contain"
        />
      )}
      {withWordmark && (
        <span className="font-display font-semibold tracking-tight" style={{ fontSize: size * 0.85 }}>
          {name}
        </span>
      )}
    </span>
  );
}
