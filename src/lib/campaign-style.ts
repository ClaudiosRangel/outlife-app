// Presets de tema (paleta de cores) e layout do banner de campanha da loja
// virtual. Fonte única usada pelo admin (preview) e pelo banner do Iniciar,
// para o visual ficar consistente. Puro/testável.

export type CampaignTheme = "forest" | "sunset" | "ocean" | "berry" | "midnight" | "lime";
export type CampaignLayout = "overlay" | "split" | "solid";

export interface ThemePreset {
  key: CampaignTheme;
  label: string;
  /** Gradiente CSS de fundo (para solid/split e overlay sem imagem). */
  gradient: string;
  /** Cor de texto sobre o fundo do tema. */
  text: string;
  /** Cor de fundo do botão CTA. */
  ctaBg: string;
  /** Cor do texto do CTA. */
  ctaText: string;
  /** Cor do chip de preço. */
  chipBg: string;
  chipText: string;
}

export const CAMPAIGN_THEMES: Record<CampaignTheme, ThemePreset> = {
  forest: {
    key: "forest", label: "Floresta",
    gradient: "linear-gradient(135deg, #14532d 0%, #16a34a 100%)",
    text: "#ffffff", ctaBg: "#f97316", ctaText: "#ffffff",
    chipBg: "rgba(255,255,255,0.2)", chipText: "#ffffff",
  },
  sunset: {
    key: "sunset", label: "Pôr do sol",
    gradient: "linear-gradient(135deg, #f97316 0%, #db2777 100%)",
    text: "#ffffff", ctaBg: "#ffffff", ctaText: "#db2777",
    chipBg: "rgba(255,255,255,0.25)", chipText: "#ffffff",
  },
  ocean: {
    key: "ocean", label: "Oceano",
    gradient: "linear-gradient(135deg, #0369a1 0%, #06b6d4 100%)",
    text: "#ffffff", ctaBg: "#fbbf24", ctaText: "#0c4a6e",
    chipBg: "rgba(255,255,255,0.22)", chipText: "#ffffff",
  },
  berry: {
    key: "berry", label: "Frutas",
    gradient: "linear-gradient(135deg, #7c3aed 0%, #db2777 100%)",
    text: "#ffffff", ctaBg: "#fde047", ctaText: "#4c1d95",
    chipBg: "rgba(255,255,255,0.22)", chipText: "#ffffff",
  },
  midnight: {
    key: "midnight", label: "Meia-noite",
    gradient: "linear-gradient(135deg, #0f172a 0%, #334155 100%)",
    text: "#ffffff", ctaBg: "#38bdf8", ctaText: "#0f172a",
    chipBg: "rgba(255,255,255,0.15)", chipText: "#ffffff",
  },
  lime: {
    key: "lime", label: "Limão",
    gradient: "linear-gradient(135deg, #65a30d 0%, #eab308 100%)",
    text: "#052e16", ctaBg: "#052e16", ctaText: "#ecfccb",
    chipBg: "rgba(5,46,22,0.15)", chipText: "#052e16",
  },
};

export const CAMPAIGN_LAYOUTS: { key: CampaignLayout; label: string }[] = [
  { key: "overlay", label: "Imagem cheia" },
  { key: "split", label: "Imagem + texto" },
  { key: "solid", label: "Cor sólida" },
];

export function getTheme(theme: string | null | undefined): ThemePreset {
  return CAMPAIGN_THEMES[(theme as CampaignTheme)] ?? CAMPAIGN_THEMES.forest;
}

export function normalizeLayout(layout: string | null | undefined): CampaignLayout {
  return (["overlay", "split", "solid"] as CampaignLayout[]).includes(layout as CampaignLayout)
    ? (layout as CampaignLayout)
    : "overlay";
}
