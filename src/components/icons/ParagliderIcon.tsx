import type { SVGProps } from "react";

/**
 * Icon_Parapente (Req 6): ícone de parapente/asa-delta para o tipo de
 * atividade `voo_livre`, substituindo o avião (`Plane`). Segue a assinatura
 * visual do lucide (viewBox 24, stroke currentColor, width 2, caps/joins
 * arredondados) para combinar com os demais ícones do Icon_Model_Set.
 *
 * Aceita `size` (como os ícones lucide) além dos SVGProps padrão.
 */
export function ParagliderIcon({
  size = 24,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number | string }) {
  const s = typeof size === "number" ? size : parseInt(String(size), 10) || 24;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M2 8c3-2.5 6.5-4 10-4s7 1.5 10 4" />
      <path d="M8.5 5.2 7 8.5" />
      <path d="M15.5 5.2 17 8.5" />
      <path d="M12 4.2v4.3" />
      <path d="M4.5 7.2 11 15" />
      <path d="M19.5 7.2 13 15" />
      <circle cx="12" cy="18" r="2" />
    </svg>
  );
}
