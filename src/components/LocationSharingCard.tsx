import { MapPin, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useLocationSharing } from "@/hooks/use-location-sharing";
import type { LocationSharingMode } from "@/lib/api";

type Props = {
  currentMode: LocationSharingMode | undefined;
  lastUpdate: string | null | undefined;
};

function timeAgo(iso: string, lang: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return new Intl.RelativeTimeFormat(lang, { numeric: "auto" }).format(-diffSec, "second");
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return new Intl.RelativeTimeFormat(lang, { numeric: "auto" }).format(-mins, "minute");
  const hours = Math.floor(mins / 60);
  return new Intl.RelativeTimeFormat(lang, { numeric: "auto" }).format(-hours, "hour");
}

export function LocationSharingCard({ currentMode, lastUpdate }: Props) {
  const { t, i18n } = useTranslation();
  const mode: LocationSharingMode = currentMode ?? "none";
  const { setMode, refreshNow, isPending, permissionDenied } = useLocationSharing(mode);

  return (
    <section className="px-5 mt-6">
      <div className="rounded-2xl bg-card p-4 shadow-card">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
            <MapPin size={16} />
          </span>
          <div className="flex-1">
            <div className="text-sm font-semibold">{t("location.shareTitle")}</div>
            <div className="text-[11px] text-muted-foreground">{t("location.shareDescription")}</div>
          </div>
        </div>

        <RadioGroup
          value={mode}
          onValueChange={(v) => setMode(v as LocationSharingMode)}
          className="mt-4 space-y-2"
          disabled={isPending}
        >
          {(["none", "friends", "public"] as const).map((m) => (
            <label
              key={m}
              htmlFor={`loc-mode-${m}`}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 hover:bg-secondary/40"
            >
              <RadioGroupItem id={`loc-mode-${m}`} value={m} className="mt-0.5" />
              <div className="flex-1">
                <Label htmlFor={`loc-mode-${m}`} className="text-sm font-medium cursor-pointer">
                  {t(`location.mode.${m}`)}
                </Label>
                <p className="text-[11px] text-muted-foreground">{t(`location.mode.${m}Desc`)}</p>
              </div>
            </label>
          ))}
        </RadioGroup>

        {mode !== "none" && (
          <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {lastUpdate
                ? `${t("location.lastUpdate")}: ${timeAgo(lastUpdate, i18n.language)}`
                : t("location.lastUpdate") + ": —"}
            </span>
            <button
              onClick={refreshNow}
              disabled={isPending}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-[11px] font-medium text-secondary-foreground disabled:opacity-50"
            >
              <RefreshCw size={11} className={isPending ? "animate-spin" : ""} />
              {t("location.updateNow")}
            </button>
          </div>
        )}

        {permissionDenied && (
          <p className="mt-2 text-[11px] text-destructive">{t("location.permissionDenied")}</p>
        )}

        <p className="mt-3 text-[10px] text-muted-foreground">{t("location.batteryHint")}</p>
      </div>
    </section>
  );
}
