import { WebPlugin } from "@capacitor/core";

import type {
  BackgroundPermissionStatus,
  LocationTrackingPlugin,
  StartTrackingOptions,
} from "./definitions";

/**
 * Implementação web de fallback do Native_Location_Tracking_Module, baseada em
 * `navigator.geolocation`.
 *
 * Usada apenas fora do Outlife_Native_Shell (navegador ou PWA), nunca chamada
 * quando `Capacitor.isNativePlatform()` é `true` — nesse caso a implementação
 * nativa (Android/iOS) é usada em vez desta (Requirement 2.5).
 *
 * A Web Geolocation API não distingue uma permissão "em segundo plano" de uma
 * permissão "em uso"; por isso `checkBackgroundPermission`/`requestBackgroundPermission`
 * apenas espelham a permissão de geolocalização padrão do navegador.
 */
export class LocationTrackingWeb extends WebPlugin implements LocationTrackingPlugin {
  private watchId: number | null = null;

  async requestBackgroundPermission(): Promise<BackgroundPermissionStatus> {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return { granted: false };
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve({ granted: true }),
        () => resolve({ granted: false }),
      );
    });
  }

  async checkBackgroundPermission(): Promise<BackgroundPermissionStatus> {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return { granted: false };
    }

    if (!navigator.permissions?.query) {
      // Não há como consultar sem solicitar; assume-se não concedida até que
      // requestBackgroundPermission seja chamada explicitamente.
      return { granted: false };
    }

    try {
      const status = await navigator.permissions.query({ name: "geolocation" as PermissionName });
      return { granted: status.state === "granted" };
    } catch {
      return { granted: false };
    }
  }

  async startTracking(options: StartTrackingOptions): Promise<void> {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      throw new Error("navigator.geolocation is not available");
    }

    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
    }

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        this.notifyListeners("locationUpdate", {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          ts: position.timestamp,
          accuracy: position.coords.accuracy,
        });
      },
      () => {
        // Erros individuais de captura (timeout, posição indisponível) são
        // ignorados aqui: o watch continua ativo e tenta novamente no próximo
        // evento, consistente com o comportamento já existente em
        // `use-activity-tracker.ts` fora do shell nativo.
      },
      {
        enableHighAccuracy: true,
        maximumAge: options.minIntervalMs,
      },
    );
  }

  async stopTracking(): Promise<void> {
    if (this.watchId !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  async removeAllListeners(): Promise<void> {
    await super.removeAllListeners();
  }
}
