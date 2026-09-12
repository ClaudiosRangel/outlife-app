// Icon_Model_Set — mapeia o `icon_key` de um Activity_Type (catálogo, Frente D)
// para um ícone do lucide-react + cor. Centraliza a escolha de ícone usada no
// cadastro admin, no seletor de rastreamento e (via PNGs) nos banners.
import {
  Zap,
  Footprints,
  Mountain,
  Bike,
  Waves,
  Sailboat,
  MountainSnow,
  Activity,
  type LucideIcon,
} from "lucide-react";

export interface ActivityIconModel {
  key: string;
  Icon: LucideIcon;
  /** cor de destaque (usa tokens da marca). */
  color: string;
}

// Ordem = ordem de exibição no grid de seleção do admin.
export const ICON_MODEL_SET: ActivityIconModel[] = [
  { key: "run", Icon: Zap, color: "var(--sun)" },
  { key: "walk", Icon: Footprints, color: "var(--primary)" },
  { key: "trail", Icon: Mountain, color: "var(--primary)" },
  { key: "bike", Icon: Bike, color: "var(--sun)" },
  { key: "swim", Icon: Waves, color: "var(--mountain)" },
  { key: "row", Icon: Sailboat, color: "var(--mountain)" },
  { key: "climb", Icon: MountainSnow, color: "var(--primary)" },
  { key: "activity", Icon: Activity, color: "var(--muted-foreground)" },
];

const BY_KEY = new Map(ICON_MODEL_SET.map((m) => [m.key, m]));

/** Retorna o modelo de ícone para uma icon_key, com fallback para 'activity'. */
export function getActivityIcon(iconKey: string | null | undefined): ActivityIconModel {
  return (iconKey && BY_KEY.get(iconKey)) || BY_KEY.get("activity")!;
}
