import { BadgeCheck, Clock, ShieldAlert } from "lucide-react";

export type ComplianceStatus = "verified" | "pending" | "unverified";

const config: Record<ComplianceStatus, { label: string; icon: typeof BadgeCheck; className: string }> = {
  verified: {
    label: "Verificado Cadastur",
    icon: BadgeCheck,
    className: "bg-primary/10 text-primary border-primary/20",
  },
  pending: {
    label: "Análise pendente",
    icon: Clock,
    className: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400",
  },
  unverified: {
    label: "Não verificado",
    icon: ShieldAlert,
    className: "bg-muted text-muted-foreground border-border",
  },
};

export function ComplianceBadge({
  status,
  size = "md",
}: {
  status: ComplianceStatus;
  size?: "sm" | "md";
}) {
  const { label, icon: Icon, className } = config[status];
  const padding = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";
  const iconSize = size === "sm" ? 11 : 13;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium ${padding} ${className}`}
    >
      <Icon size={iconSize} strokeWidth={2.4} />
      {label}
    </span>
  );
}
