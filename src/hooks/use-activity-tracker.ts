import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { LocationTracking } from "@outlife/capacitor-location-tracking";
import { haversineMeters } from "@/lib/haversine";
import { shouldCheckpoint } from "@/lib/location-checkpoint";
import { getProfile, MISSING_ACCURACY_POLICY } from "@/lib/tracking-config";
import { validatePoint, type RawSample } from "@/lib/point-validation";
import {
  computeSmoothedSpeed,
  pushWindow,
  type SpeedWindowPoint,
} from "@/lib/instant-speed";
import {
  deriveGpsSignal,
  pushAccuracy,
  type GpsSignalState,
} from "@/lib/gps-signal";
import type { ActivityType } from "@/lib/activity-metrics";
import {
  loadActive,
  saveActive,
  clearActive,
  type ActivePersisted,
} from "@/lib/activity-storage";

export type TrackPoint = { lat: number; lng: number; ts: number; alt?: number; speed?: number };
export type TrackerStatus = "idle" | "tracking" | "paused" | "saving";

export function useActivityTracker() {
  const [status, setStatus] = useState<TrackerStatus>("idle");
  const [points, setPoints] = useState<TrackPoint[]>([]);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  const [elevationGain, setElevationGain] = useState(0);
  // Estado observável de pausa automática (Requirement 3): espelha
  // `autoPausedRef` de forma reativa para a UI distinguir o auto-pause
  // (por inatividade) da pausa manual. Ação manual sempre tem precedência.
  const [autoPaused, setAutoPaused] = useState(false);
  // Velocidade instantânea suavizada (m/s) e estado de qualidade do sinal de
  // GPS, expostos para a UI (spec rastreamento-preciso-gps, Req 4 e 6).
  const [smoothedSpeed, setSmoothedSpeed] = useState<number | null>(null);
  const [gpsSignalState, setGpsSignalState] = useState<GpsSignalState>("aquisitando");
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
  const elevationGainRef = useRef(0);
  // Handle do listener nativo `locationUpdate` (Native_Location_Tracking_Module),
  // usado apenas quando `Capacitor.isNativePlatform()` é `true` (Requirement 2.5).
  const nativeListenerRef = useRef<PluginListenerHandle | null>(null);
  // Estado do Location_Persistence_Checkpoint (Requirement 3.1): quando/onde
  // ocorreu o último checkpoint, independente da fonte dos pontos.
  const lastCheckpointTsRef = useRef(Date.now());
  const lastCheckpointDistanceRef = useRef(0);
  // Auto-pause: timestamp do último ponto com deslocamento > 2m
  const lastMovementTsRef = useRef(Date.now());
  // Flag para distinguir auto-pause (por inatividade) de pause manual
  const autoPausedRef = useRef(false);
  // Point_Validation: última Accepted_Point (referência de validação). Só é
  // atualizada quando uma amostra é aceita (Req 2.7/3.6). Substitui o uso de
  // pointsRef[last] como referência.
  const lastAcceptedRef = useRef<{ lat: number; lng: number; ts: number } | null>(null);
  // Janela curta de Accepted_Points para a Smoothed_Speed (Req 4.2).
  const speedWindowRef = useRef<SpeedWindowPoint[]>([]);
  // Janela de acurácias recentes + timestamp da última amostra recebida
  // (qualquer amostra, aceita ou não), para o GPS_Signal_State (Req 6).
  const signalAccuraciesRef = useRef<number[]>([]);
  const lastSampleTsRef = useRef(0);

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
      elevationGain: elevationGainRef.current,
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

  // Caminho único de processamento de uma amostra de localização (web ou
  // nativa), spec rastreamento-preciso-gps. Aplica Point_Validation antes de
  // acumular distância/trajeto/elevação; a posição do mapa (currentPos) é
  // sempre atualizada, mesmo quando a amostra é rejeitada (Req 3.7).
  const ingestSample = useCallback((sample: RawSample) => {
    // Registra a chegada da amostra para o GPS_Signal_State (Req 6), qualquer
    // que seja o destino da validação.
    lastSampleTsRef.current = Date.now();
    if (sample.accuracy != null && Number.isFinite(sample.accuracy)) {
      signalAccuraciesRef.current = pushAccuracy(signalAccuraciesRef.current, sample.accuracy);
    }

    // Posição exibida no mapa acompanha o usuário mesmo em rejeição (Req 3.7).
    const displayPt: TrackPoint = {
      lat: sample.lat,
      lng: sample.lng,
      ts: sample.ts,
      alt: sample.altitude ?? undefined,
      speed: sample.speed ?? undefined,
    };
    setCurrentPos(displayPt);

    const profile = getProfile(activityTypeRef.current as ActivityType | null);
    const res = validatePoint(
      sample,
      { lastAccepted: lastAcceptedRef.current },
      profile,
      MISSING_ACCURACY_POLICY,
    );

    // Amostra rejeitada: referência e agregados intactos (Req 1.1, 2.3, 3.1).
    if (!res.accepted) return;

    const prev = lastAcceptedRef.current;
    const acceptedPt: TrackPoint = {
      lat: sample.lat,
      lng: sample.lng,
      ts: sample.ts,
      alt: sample.altitude ?? undefined,
      speed: sample.speed ?? undefined,
    };

    if (prev) {
      // Distância só entre Accepted_Points (Req 4.1, 7.2, Property 10).
      distanceRef.current += haversineMeters(prev, acceptedPt);
      setDistance(distanceRef.current);
      // Elevation gain: soma apenas subidas > 2m (filtra ruído barométrico),
      // usando a última Accepted_Point como referência.
      const prevAlt = pointsRef.current[pointsRef.current.length - 1]?.alt;
      if (acceptedPt.alt != null && prevAlt != null) {
        const altDiff = acceptedPt.alt - prevAlt;
        if (altDiff > 2) {
          elevationGainRef.current += altDiff;
          setElevationGain(elevationGainRef.current);
        }
      }
    }

    // Auto-resume se estava em auto-pause (movimento detectado).
    lastMovementTsRef.current = Date.now();
    if (autoPausedRef.current) {
      autoPausedRef.current = false;
      setAutoPaused(false);
      setStatus("tracking");
      if (!timerRef.current) {
        timerRef.current = setInterval(() => {
          durationRef.current += 1;
          setDuration(durationRef.current);
        }, 1000);
      }
    }

    // Atualiza a referência de validação SOMENTE em accept (Req 2.7/3.6).
    lastAcceptedRef.current = { lat: sample.lat, lng: sample.lng, ts: sample.ts };
    pointsRef.current = [...pointsRef.current, acceptedPt];
    setPoints(pointsRef.current);
    speedWindowRef.current = pushWindow(speedWindowRef.current, acceptedPt);
  }, []);

  const startWatch = useCallback(() => {
    // Requirement 2.5: dentro do Outlife_Native_Shell, a captura usa o
    // Native_Location_Tracking_Module; fora dele, a Web Geolocation API.
    // Ambas as fontes alimentam o mesmo `ingestSample` (caminho único).
    if (Capacitor.isNativePlatform()) {
      void LocationTracking.startTracking({ minIntervalMs: 1000, minDistanceMeters: 1 });
      void LocationTracking.addListener("locationUpdate", (point) => {
        ingestSample({
          lat: point.lat,
          lng: point.lng,
          ts: point.ts,
          accuracy: point.accuracy,
          // Plugin nativo usa -1 para indisponível; normaliza para null.
          altitude: point.altitude != null && point.altitude >= 0 ? point.altitude : null,
          speed: point.speed != null && point.speed >= 0 ? point.speed : null,
        });
      }).then((handle) => {
        nativeListenerRef.current = handle;
      });
      return;
    }

    if (!("geolocation" in navigator)) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        ingestSample({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          ts: pos.timestamp,
          accuracy: pos.coords.accuracy ?? null,
          altitude: pos.coords.altitude ?? null,
          speed: pos.coords.speed != null && pos.coords.speed >= 0 ? pos.coords.speed : null,
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setPermissionDenied(true);
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 },
    );
  }, [ingestSample]);

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

        // Recupera o ganho de elevação persistido. O campo é opcional em
        // registros antigos (retrocompat) e ainda pode não existir no tipo
        // `ActivePersisted` neste momento (adicionado pela task 3.1), por
        // isso o acesso é defensivo, tratando ausência como 0.
        const restoredElevationGain =
          (p as { elevationGain?: number }).elevationGain ?? 0;

        pointsRef.current = p.points;
        distanceRef.current = p.distance;
        durationRef.current = restoredDuration;
        elevationGainRef.current = restoredElevationGain;
        activityIdRef.current = p.activityId ?? null;
        activityTypeRef.current = p.activityType ?? null;
        // Reidrata a referência de validação do último ponto persistido (só
        // Accepted_Points), evitando salto artificial ao retomar (Req 7.4/7.5).
        const lastPt = p.points[p.points.length - 1];
        lastAcceptedRef.current = lastPt
          ? { lat: lastPt.lat, lng: lastPt.lng, ts: lastPt.ts }
          : null;
        speedWindowRef.current = p.points.slice(-5).map((pt) => ({ lat: pt.lat, lng: pt.lng, ts: pt.ts }));
        signalAccuraciesRef.current = [];
        lastSampleTsRef.current = Date.now();
        setPoints(p.points);
        setDistance(p.distance);
        setDuration(restoredDuration);
        setElevationGain(restoredElevationGain);
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
    elevationGainRef.current = 0;
    lastCheckpointTsRef.current = Date.now();
    lastCheckpointDistanceRef.current = 0;
    lastMovementTsRef.current = Date.now();
    autoPausedRef.current = false;
    setAutoPaused(false);
    // Reset da filtragem/velocidade/sinal (spec rastreamento-preciso-gps).
    lastAcceptedRef.current = null;
    speedWindowRef.current = [];
    signalAccuraciesRef.current = [];
    lastSampleTsRef.current = Date.now();
    setSmoothedSpeed(null);
    setGpsSignalState("aquisitando");
    setPoints([]);
    setDistance(0);
    setDuration(0);
    setElevationGain(0);
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
    // Ação manual tem precedência sobre o auto-pause (Requirement 3.4/3.5).
    autoPausedRef.current = false;
    setAutoPaused(false);
    setStatus("paused");
    persist("paused");
  }, [persist]);

  const resume = useCallback(() => {
    // Ação manual tem precedência sobre o auto-pause (Requirement 3.5).
    autoPausedRef.current = false;
    setAutoPaused(false);
    setStatus("tracking");
    startWatch();
    startTimer();
  }, [startTimer, startWatch]);

  const discard = useCallback(() => {
    stopWatch();
    stopTimer();
    // Ação manual tem precedência sobre o auto-pause (Requirement 3.5).
    autoPausedRef.current = false;
    setAutoPaused(false);
    pointsRef.current = [];
    distanceRef.current = 0;
    durationRef.current = 0;
    elevationGainRef.current = 0;
    lastAcceptedRef.current = null;
    speedWindowRef.current = [];
    signalAccuraciesRef.current = [];
    setPoints([]);
    setDistance(0);
    setDuration(0);
    setElevationGain(0);
    setSmoothedSpeed(null);
    setGpsSignalState("aquisitando");
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
    // Ação manual tem precedência sobre o auto-pause (Requirement 3.5).
    autoPausedRef.current = false;
    setAutoPaused(false);
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
      elevationGain: elevationGainRef.current,
    };
  }, []);

  const reset = useCallback(() => {
    pointsRef.current = [];
    distanceRef.current = 0;
    durationRef.current = 0;
    elevationGainRef.current = 0;
    lastAcceptedRef.current = null;
    speedWindowRef.current = [];
    signalAccuraciesRef.current = [];
    setPoints([]);
    setDistance(0);
    setDuration(0);
    setElevationGain(0);
    setSmoothedSpeed(null);
    setGpsSignalState("aquisitando");
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

  // Auto-pause: se o usuário não se moveu > 2m nos últimos 15 segundos,
  // pausa o timer automaticamente (como o Strava). O GPS continua captando
  // pontos — ao detectar movimento novamente, retoma o timer
  // automaticamente (ver lógica em startWatch acima).
  useEffect(() => {
    if (status !== "tracking") return;
    const AUTO_PAUSE_THRESHOLD_MS = 15_000;
    const interval = setInterval(() => {
      const sinceLastMove = Date.now() - lastMovementTsRef.current;
      if (sinceLastMove >= AUTO_PAUSE_THRESHOLD_MS && !autoPausedRef.current) {
        autoPausedRef.current = true;
        setAutoPaused(true);
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

  // Recálculo de Smoothed_Speed e GPS_Signal_State a cada 1s (spec
  // rastreamento-preciso-gps, Req 4 e 6). Evita re-render por ponto e aplica
  // as janelas de validade (SPEED_STALE_MS / NO_SIGNAL_TIMEOUT_MS).
  useEffect(() => {
    if (status === "idle" || status === "saving") {
      setSmoothedSpeed(null);
      return;
    }
    const interval = setInterval(() => {
      const now = Date.now();
      // Durante pausa (manual ou auto), exibe velocidade zero (Req 4.4/4.5).
      if (status === "paused" || autoPausedRef.current) {
        setSmoothedSpeed(0);
      } else {
        setSmoothedSpeed(computeSmoothedSpeed(speedWindowRef.current, now));
      }
      const profile = getProfile(activityTypeRef.current as ActivityType | null);
      setGpsSignalState(
        deriveGpsSignal({
          recentAccuracies: signalAccuraciesRef.current,
          msSinceLastSample: now - lastSampleTsRef.current,
          hasFirstAcceptedPoint: lastAcceptedRef.current != null,
          maxAccuracyMeters: profile.maxAccuracyMeters,
        }),
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => () => {
    stopWatch();
    stopTimer();
  }, []);

  return {
    status,
    points,
    distanceMeters: distance,
    durationSeconds: duration,
    elevationGainMeters: elevationGain,
    autoPaused,
    smoothedSpeedMps: smoothedSpeed,
    gpsSignalState,
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
