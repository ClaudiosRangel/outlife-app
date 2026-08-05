import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { LocationTracking } from "@outlife/capacitor-location-tracking";
import { haversineMeters } from "@/lib/haversine";
import { shouldCheckpoint } from "@/lib/location-checkpoint";
import {
  loadActive,
  saveActive,
  clearActive,
  type ActivePersisted,
} from "@/lib/activity-storage";

export type TrackPoint = { lat: number; lng: number; ts: number };
export type TrackerStatus = "idle" | "tracking" | "paused" | "saving";

export function useActivityTracker() {
  const [status, setStatus] = useState<TrackerStatus>("idle");
  const [points, setPoints] = useState<TrackPoint[]>([]);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  // ID do registro no Supabase + tipo de atividade, persistidos junto
  // com o estado para sobreviver à navegação entre telas.
  const activityIdRef = useRef<string | null>(null);
  const activityTypeRef = useRef<string | null>(null);
  const [currentPos, setCurrentPos] = useState<TrackPoint | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pointsRef = useRef<TrackPoint[]>([]);
  const distanceRef = useRef(0);
  const durationRef = useRef(0);
  // Handle do listener nativo `locationUpdate` (Native_Location_Tracking_Module),
  // usado apenas quando `Capacitor.isNativePlatform()` é `true` (Requirement 2.5).
  const nativeListenerRef = useRef<PluginListenerHandle | null>(null);
  // Estado do Location_Persistence_Checkpoint (Requirement 3.1): quando/onde
  // ocorreu o último checkpoint, independente da fonte dos pontos.
  const lastCheckpointTsRef = useRef(Date.now());
  const lastCheckpointDistanceRef = useRef(0);
  // Auto-pause: timestamp do último ponto com deslocamento > 5m
  const lastMovementTsRef = useRef(Date.now());
  // Flag para distinguir auto-pause (por inatividade) de pause manual
  const autoPausedRef = useRef(false);

  const [hasOrphan, setHasOrphan] = useState(false);
  const [orphanUnrecoverable, setOrphanUnrecoverable] = useState(false);
  // Requirement 2.7: revogação da permissão de localização em segundo
  // plano enquanto uma User_Activity está `in_progress` — interrompe a
  // captura de novos pontos sem descartar os já persistidos, e informa o
  // usuário via este estado (consumido por `atividade.rastrear.tsx`).
  const [revokedDuringTracking, setRevokedDuringTracking] = useState(false);
  const permissionRevokedListenerRef = useRef<PluginListenerHandle | null>(null);
  // Flag para evitar re-restauração — o efeito de restauração só roda uma vez.
  const restoredRef = useRef(false);

  const persist = useCallback((nextStatus: TrackerStatus) => {
    const payload: ActivePersisted = {
      points: pointsRef.current,
      distance: distanceRef.current,
      duration: durationRef.current,
      status: nextStatus,
      updatedAt: Date.now(),
      activityId: activityIdRef.current,
      activityType: activityTypeRef.current,
    };
    void saveActive(payload);
  }, []);

  // Requirement 2.7: registra o listener `permissionRevoked` do
  // Native_Location_Tracking_Module. Quando a permissão de localização em
  // segundo plano é revogada enquanto o rastreamento está ativo, interrompe
  // a captura de novos pontos (sem descartar/resetar pointsRef/distanceRef,
  // preservando o que já foi capturado) e expõe `revokedDuringTracking`
  // para a UI informar o usuário.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cancelled = false;
    LocationTracking.addListener("permissionRevoked", () => {
      if (cancelled) return;
      void LocationTracking.stopTracking();
      if (nativeListenerRef.current) {
        nativeListenerRef.current.remove();
        nativeListenerRef.current = null;
      }
      setRevokedDuringTracking(true);
      setStatus((prev) => (prev === "tracking" ? "paused" : prev));
      persist("paused");
    }).then((handle) => {
      if (cancelled) {
        handle.remove();
        return;
      }
      permissionRevokedListenerRef.current = handle;
    });
    return () => {
      cancelled = true;
      permissionRevokedListenerRef.current?.remove();
      permissionRevokedListenerRef.current = null;
    };
  }, [persist]);

  const stopWatch = () => {
    // Requirement 2.5: seleção exclusiva de estratégia de localização —
    // dentro do Outlife_Native_Shell, interrompe o Native_Location_Tracking_Module;
    // fora do shell, mantém o comportamento já existente via Web Geolocation API.
    if (Capacitor.isNativePlatform()) {
      void LocationTracking.stopTracking();
      if (nativeListenerRef.current) {
        nativeListenerRef.current.remove();
        nativeListenerRef.current = null;
      }
      return;
    }
    if (watchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startWatch = useCallback(() => {
    // Requirement 2.1/2.5: dentro do Outlife_Native_Shell, a captura de
    // localização usa o Native_Location_Tracking_Module (Foreground Service
    // Android / Background Location Mode iOS) em vez da Web Geolocation
    // API, alimentando o mesmo pointsRef/setPoints/distanceRef já
    // existentes através do listener `locationUpdate`.
    if (Capacitor.isNativePlatform()) {
      void LocationTracking.startTracking({ minIntervalMs: 5000, minDistanceMeters: 10 });
      void LocationTracking.addListener("locationUpdate", (point) => {
        const pt: TrackPoint = { lat: point.lat, lng: point.lng, ts: point.ts };
        setCurrentPos(pt);
        const last = pointsRef.current[pointsRef.current.length - 1];
        if (last) {
          const d = haversineMeters(last, pt);
          if (d < 5) return;
          distanceRef.current += d;
          setDistance(distanceRef.current);
          lastMovementTsRef.current = Date.now();
          // Auto-resume se estava em auto-pause
          if (autoPausedRef.current) {
            autoPausedRef.current = false;
            setStatus("tracking");
            if (!timerRef.current) {
              timerRef.current = setInterval(() => {
                durationRef.current += 1;
                setDuration(durationRef.current);
              }, 1000);
            }
          }
        }
        pointsRef.current = [...pointsRef.current, pt];
        setPoints(pointsRef.current);
      }).then((handle) => {
        nativeListenerRef.current = handle;
      });
      return;
    }

    // Fora do Outlife_Native_Shell: mantém a Web Geolocation API já
    // existente, inalterada (Requirement 2.5).
    if (!("geolocation" in navigator)) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const accuracy = pos.coords.accuracy;
        if (accuracy != null && accuracy > 30) return;
        const pt: TrackPoint = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          ts: pos.timestamp,
        };
        setCurrentPos(pt);
        const last = pointsRef.current[pointsRef.current.length - 1];
        if (last) {
          const d = haversineMeters(last, pt);
          if (d < 5) return;
          distanceRef.current += d;
          setDistance(distanceRef.current);
          lastMovementTsRef.current = Date.now();
          // Auto-resume se estava em auto-pause
          if (autoPausedRef.current) {
            autoPausedRef.current = false;
            setStatus("tracking");
            if (!timerRef.current) {
              timerRef.current = setInterval(() => {
                durationRef.current += 1;
                setDuration(durationRef.current);
              }, 1000);
            }
          }
        }
        pointsRef.current = [...pointsRef.current, pt];
        setPoints(pointsRef.current);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setPermissionDenied(true);
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
  }, []);

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      durationRef.current += 1;
      setDuration(durationRef.current);
    }, 1000);
  }, []);

  // Restauração automática: ao montar o componente, se há atividade salva
  // ("tracking"/"paused"), restaura e retoma automaticamente sem pausar.
  // O GPS nativo continua em segundo plano; o tempo decorrido enquanto
  // esteve fora da tela é calculado a partir de `updatedAt`.
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    loadActive().then((p) => {
      if (!p) return;
      if ("corrupted" in p) {
        setOrphanUnrecoverable(true);
        setHasOrphan(true);
        return;
      }
      if (p.status === "tracking" || p.status === "paused") {
        const elapsedSinceLastSave = Math.floor((Date.now() - (p.updatedAt || Date.now())) / 1000);
        const restoredDuration = p.status === "tracking"
          ? p.duration + Math.max(0, elapsedSinceLastSave)
          : p.duration;

        pointsRef.current = p.points;
        distanceRef.current = p.distance;
        durationRef.current = restoredDuration;
        activityIdRef.current = p.activityId ?? null;
        activityTypeRef.current = p.activityType ?? null;
        setPoints(p.points);
        setDistance(p.distance);
        setDuration(restoredDuration);
        setStatus("tracking");
        startWatch();
        startTimer();
        return;
      }
      if (p.points.length > 0) {
        setHasOrphan(true);
      }
    });
  }, [startWatch, startTimer]);

  // Retorna `true` quando o rastreamento de fato iniciou (status passou a
  // "tracking"), ou `false` quando bloqueado por permissão negada (nesse
  // caso `permissionDenied` já fica exposto para a UI exibir o aviso
  // específico — não é uma condição de exceção). Qualquer outra falha
  // (ex.: erro do plugin nativo) propaga via `throw`, para o chamador
  // distinguir "não iniciou por falta de permissão" (esperado) de "não
  // iniciou por um erro inesperado" (deve mostrar mensagem de erro).
  const start = useCallback(async (): Promise<boolean> => {
    // Requirement 2.6: dentro do Outlife_Native_Shell, checa a permissão de
    // localização em segundo plano antes de iniciar o rastreamento; se não
    // concedida, solicita, e se ainda não concedida, bloqueia o início e
    // expõe `permissionDenied` para a UI exibir a mensagem explicativa —
    // consistente com o tratamento já existente para a Web Geolocation API.
    if (Capacitor.isNativePlatform()) {
      const current = await LocationTracking.checkBackgroundPermission();
      let granted = current.granted;
      if (!granted) {
        const requested = await LocationTracking.requestBackgroundPermission();
        granted = requested.granted;
      }
      if (!granted) {
        setPermissionDenied(true);
        return false;
      }
    }

    setPermissionDenied(false);
    setRevokedDuringTracking(false);
    setHasOrphan(false);
    void clearActive();
    pointsRef.current = [];
    distanceRef.current = 0;
    durationRef.current = 0;
    lastCheckpointTsRef.current = Date.now();
    lastCheckpointDistanceRef.current = 0;
    lastMovementTsRef.current = Date.now();
    autoPausedRef.current = false;
    setPoints([]);
    setDistance(0);
    setDuration(0);
    setStatus("tracking");
    startWatch();
    startTimer();
    // Persiste imediatamente para que, se o usuário navegar para outro menu
    // antes do primeiro checkpoint (10s/50m), o estado "tracking" já
    // esteja salvo e possa ser restaurado ao voltar.
    persist("tracking");
    return true;
  }, [startTimer, startWatch]);

  const pause = useCallback(() => {
    stopWatch();
    stopTimer();
    setStatus("paused");
    persist("paused");
  }, [persist]);

  const resume = useCallback(() => {
    setStatus("tracking");
    startWatch();
    startTimer();
  }, [startTimer, startWatch]);

  const discard = useCallback(() => {
    stopWatch();
    stopTimer();
    pointsRef.current = [];
    distanceRef.current = 0;
    durationRef.current = 0;
    setPoints([]);
    setDistance(0);
    setDuration(0);
    setStatus("idle");
    setHasOrphan(false);
    setOrphanUnrecoverable(false);
    void clearActive();
  }, []);

  const restoreOrphan = useCallback(async () => {
    const p = await loadActive();
    // Dados corrompidos (Requirement 3.4) nunca são restaurados — a UI só
    // deve oferecer descartar nesse caso (orphanUnrecoverable).
    if (!p || "corrupted" in p) return;
    pointsRef.current = p.points;
    distanceRef.current = p.distance;
    durationRef.current = p.duration;
    setPoints(p.points);
    setDistance(p.distance);
    setDuration(p.duration);
    setStatus("paused");
    setHasOrphan(false);
    setOrphanUnrecoverable(false);
  }, []);

  const finalize = useCallback(() => {
    stopWatch();
    stopTimer();
    setStatus("saving");
    const route: GeoJSON.LineString | null =
      pointsRef.current.length >= 2
        ? {
            type: "LineString",
            coordinates: pointsRef.current.map((p) => [p.lng, p.lat]),
          }
        : null;
    return {
      route,
      distance: distanceRef.current,
      duration: durationRef.current,
      points: pointsRef.current,
    };
  }, []);

  const reset = useCallback(() => {
    pointsRef.current = [];
    distanceRef.current = 0;
    durationRef.current = 0;
    setPoints([]);
    setDistance(0);
    setDuration(0);
    setStatus("idle");
    void clearActive();
  }, []);

  // Location_Persistence_Checkpoint: dispara a cada 10s ou 50m percorridos
  // (shouldCheckpoint, Requirement 3.1), independente da fonte dos pontos
  // (Web Geolocation API ou Native_Location_Tracking_Module).
  useEffect(() => {
    if (status !== "tracking" || points.length === 0) return;
    const now = Date.now();
    if (
      shouldCheckpoint({
        lastCheckpointTs: lastCheckpointTsRef.current,
        lastCheckpointDistanceAccum: lastCheckpointDistanceRef.current,
        nowTs: now,
        distanceAccum: distanceRef.current,
      })
    ) {
      lastCheckpointTsRef.current = now;
      lastCheckpointDistanceRef.current = distanceRef.current;
      persist("tracking");
    }
  }, [points.length, status, persist]);

  // Auto-pause: se o usuário não se moveu > 5m nos últimos 30 segundos,
  // pausa o timer automaticamente (como o Strava). O GPS continua captando
  // pontos — ao detectar movimento novamente, retoma o timer
  // automaticamente (ver lógica em startWatch acima).
  useEffect(() => {
    if (status !== "tracking") return;
    const AUTO_PAUSE_THRESHOLD_MS = 30_000;
    const interval = setInterval(() => {
      const sinceLastMove = Date.now() - lastMovementTsRef.current;
      if (sinceLastMove >= AUTO_PAUSE_THRESHOLD_MS && !autoPausedRef.current) {
        autoPausedRef.current = true;
        setStatus("paused");
        // Para o timer mas NÃO o GPS — continua escutando pontos
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        persist("paused");
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [status, persist]);

  useEffect(() => () => {
    stopWatch();
    stopTimer();
  }, []);

  return {
    status,
    points,
    distanceMeters: distance,
    durationSeconds: duration,
    currentPos,
    permissionDenied,
    revokedDuringTracking,
    hasOrphan,
    orphanUnrecoverable,
    activityId: activityIdRef.current,
    activityType: activityTypeRef.current,
    setActivityId: (id: string | null) => { activityIdRef.current = id; },
    setActivityType: (type: string | null) => { activityTypeRef.current = type; },
    start,
    pause,
    resume,
    finalize,
    discard,
    reset,
    restoreOrphan,
  };
}
