import type { PluginListenerHandle } from "@capacitor/core";

/**
 * Um ponto de localização capturado pelo Native_Location_Tracking_Module.
 */
export interface LocationTrackingPoint {
  lat: number;
  lng: number;
  ts: number;
  accuracy: number;
}

export interface BackgroundPermissionStatus {
  granted: boolean;
}

export interface StartTrackingOptions {
  /** Intervalo mínimo entre capturas, em milissegundos (mínimo 5000 conforme Requirement 2.1). */
  minIntervalMs: number;
  /** Distância mínima entre capturas, em metros (mínimo 10 conforme Requirement 2.1). */
  minDistanceMeters: number;
}

/**
 * Contrato único do Native_Location_Tracking_Module, independente de plataforma.
 *
 * Implementado nativamente como Foreground Service (Android) e Background Location
 * Mode (iOS). Fora do Outlife_Native_Shell, `web.ts` fornece um fallback baseado em
 * `navigator.geolocation`, usado apenas quando `Capacitor.isNativePlatform()` é `false`.
 */
export interface LocationTrackingPlugin {
  /** Solicita a permissão de localização em segundo plano ao usuário. */
  requestBackgroundPermission(): Promise<BackgroundPermissionStatus>;

  /** Verifica o estado atual da permissão de localização em segundo plano, sem solicitá-la. */
  checkBackgroundPermission(): Promise<BackgroundPermissionStatus>;

  /** Inicia a captura de localização em segundo plano com a frequência informada. */
  startTracking(options: StartTrackingOptions): Promise<void>;

  /** Interrompe a captura de localização em segundo plano. */
  stopTracking(): Promise<void>;

  addListener(
    eventName: "locationUpdate",
    listenerFunc: (point: LocationTrackingPoint) => void,
  ): Promise<PluginListenerHandle>;

  addListener(eventName: "permissionRevoked", listenerFunc: () => void): Promise<PluginListenerHandle>;

  removeAllListeners(): Promise<void>;
}
