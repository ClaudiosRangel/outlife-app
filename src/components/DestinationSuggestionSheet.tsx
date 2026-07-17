import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, MapPin, Check, Loader2, Send } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { createPendingDestination } from "@/lib/api";

type Coords = { latitude: number; longitude: number };

type FormErrors = {
  name?: string;
  location?: string;
};

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(new Error("unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60_000,
    });
  });
}

type Props = {
  triggerClassName?: string;
};

export function DestinationSuggestionSheet({ triggerClassName }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});

  const resetForm = () => {
    setName("");
    setDescription("");
    setCoords(null);
    setLocationError(null);
    setErrors({});
  };

  const handleOpenChange = (next: boolean) => {
    if (next && !user) {
      toast.error(t("destinationSuggestion.loginRequired"));
      return;
    }
    setOpen(next);
    if (!next) resetForm();
  };

  const handleUseCurrentLocation = async () => {
    setLocationError(null);
    setLocating(true);
    try {
      const pos = await getCurrentPosition();
      setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      setErrors((e) => ({ ...e, location: undefined }));
    } catch (e: unknown) {
      const err = e as { code?: number; message?: string };
      if (err.message === "unavailable") {
        setLocationError(t("destinationSuggestion.locationErrorUnavailable"));
      } else if (err.code === 1) {
        setLocationError(t("destinationSuggestion.locationErrorDenied"));
      } else {
        setLocationError(t("destinationSuggestion.locationErrorGeneric"));
      }
    } finally {
      setLocating(false);
    }
  };

  const mutation = useMutation({
    mutationFn: () =>
      createPendingDestination({
        name: name.trim(),
        description: description.trim() || undefined,
        latitude: coords!.latitude,
        longitude: coords!.longitude,
      }),
    onSuccess: () => {
      toast.success(t("destinationSuggestion.success"));
      setOpen(false);
      resetForm();
    },
    onError: (e: Error) => {
      toast.error(e.message || t("destinationSuggestion.error"));
    },
  });

  const validate = (): boolean => {
    const nextErrors: FormErrors = {};
    if (!name.trim()) {
      nextErrors.name = t("destinationSuggestion.nameRequired");
    }
    const validLocation =
      coords != null &&
      Number.isFinite(coords.latitude) &&
      Number.isFinite(coords.longitude) &&
      Math.abs(coords.latitude) <= 90 &&
      Math.abs(coords.longitude) <= 180;
    if (!validLocation) {
      nextErrors.location = t("destinationSuggestion.locationRequired");
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    mutation.mutate();
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <button
          className={
            triggerClassName ??
            "flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card py-3.5 text-sm font-semibold text-foreground active:scale-[0.98] transition-transform"
          }
        >
          <Plus size={16} />
          {t("destinationSuggestion.trigger")}
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display">{t("destinationSuggestion.title")}</SheetTitle>
          <SheetDescription>{t("destinationSuggestion.description")}</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="suggestion-name">{t("destinationSuggestion.nameLabel")}</Label>
            <Input
              id="suggestion-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((err) => ({ ...err, name: undefined }));
              }}
              placeholder={t("destinationSuggestion.namePlaceholder")}
              maxLength={120}
            />
            {errors.name && <p className="text-[11px] font-medium text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="suggestion-desc">{t("destinationSuggestion.descriptionLabel")}</Label>
            <Textarea
              id="suggestion-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("destinationSuggestion.descriptionPlaceholder")}
              rows={3}
              maxLength={500}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t("destinationSuggestion.locationLabel")}</Label>
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={locating}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-secondary/50 py-3 text-sm font-medium text-foreground disabled:opacity-60"
            >
              {locating ? (
                <Loader2 size={16} className="animate-spin" />
              ) : coords ? (
                <Check size={16} className="text-primary" />
              ) : (
                <MapPin size={16} />
              )}
              {locating
                ? t("destinationSuggestion.locating")
                : coords
                  ? t("destinationSuggestion.locationCaptured")
                  : t("destinationSuggestion.useCurrentLocation")}
            </button>
            {coords && (
              <p className="text-[11px] text-muted-foreground">
                {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
              </p>
            )}
            {locationError && (
              <p className="text-[11px] font-medium text-destructive">{locationError}</p>
            )}
            {errors.location && (
              <p className="text-[11px] font-medium text-destructive">{errors.location}</p>
            )}
          </div>

          <Button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="mt-2 w-full rounded-xl py-3.5 text-sm font-semibold"
          >
            {mutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
            {mutation.isPending
              ? t("destinationSuggestion.submitting")
              : t("destinationSuggestion.submit")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
