import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  updateMyLocation,
  updateLocationSharingMode,
  type LocationSharingMode,
} from "@/lib/api";

const REFRESH_MS = 3 * 60 * 1000; // 3 minutos

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(new Error("Geolocalização indisponível"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60_000,
    });
  });
}

export function useLocationSharing(currentMode: LocationSharingMode | undefined) {
  const queryClient = useQueryClient();
  const [permissionDenied, setPermissionDenied] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pushMutation = useMutation({
    mutationFn: (mode: Exclude<LocationSharingMode, "none">) =>
      getCurrentPosition().then((pos) =>
        updateMyLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          mode,
        }),
      ),
    onSuccess: () => {
      setPermissionDenied(false);
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      queryClient.invalidateQueries({ queryKey: ["shared-locations"] });
    },
    onError: (e: unknown) => {
      const err = e as { code?: number; message?: string };
      if (err.code === 1) {
        setPermissionDenied(true);
        toast.error("Permissão de localização negada.");
      } else {
        toast.error(err.message ?? "Erro ao obter localização.");
      }
    },
  });

  const modeMutation = useMutation({
    mutationFn: updateLocationSharingMode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      queryClient.invalidateQueries({ queryKey: ["shared-locations"] });
    },
  });

  const setMode = useCallback(
    async (mode: LocationSharingMode) => {
      if (mode === "none") {
        await modeMutation.mutateAsync("none");
        toast.success("Compartilhamento desativado.");
        return;
      }
      // Para friends/public: tenta obter posição e já grava com o novo modo.
      await pushMutation.mutateAsync(mode);
      toast.success("Localização compartilhada.");
    },
    [modeMutation, pushMutation],
  );

  const refreshNow = useCallback(() => {
    if (!currentMode || currentMode === "none") return;
    pushMutation.mutate(currentMode);
  }, [currentMode, pushMutation]);

  // Atualização periódica
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (!currentMode || currentMode === "none") return;
    intervalRef.current = setInterval(() => {
      pushMutation.mutate(currentMode);
    }, REFRESH_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [currentMode, pushMutation]);

  return {
    setMode,
    refreshNow,
    permissionDenied,
    isPending: pushMutation.isPending || modeMutation.isPending,
  };
}
