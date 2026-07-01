import { useCallback, useEffect, useRef, useState } from "react";
import { haversineMeters } from "@/lib/haversine";
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
  const [currentPos, setCurrentPos] = useState<TrackPoint | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pointsRef = useRef<TrackPoint[]>([]);
  const distanceRef = useRef(0);
  const durationRef = useRef(0);

  const [hasOrphan, setHasOrphan] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadActive().then((p) => {
      if (!cancelled && p && p.points.length > 0) setHasOrphan(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((nextStatus: TrackerStatus) => {
    const payload: ActivePersisted = {
      points: pointsRef.current,
      distance: distanceRef.current,
      duration: durationRef.current,
      status: nextStatus,
      updatedAt: Date.now(),
    };
    void saveActive(payload);
  }, []);

  const stopWatch = () => {
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

  const start = useCallback(() => {
    setHasOrphan(false);
    void clearActive();
    pointsRef.current = [];
    distanceRef.current = 0;
    durationRef.current = 0;
    setPoints([]);
    setDistance(0);
    setDuration(0);
    setStatus("tracking");
    startWatch();
    startTimer();
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
    void clearActive();
  }, []);

  const restoreOrphan = useCallback(async () => {
    const p = await loadActive();
    if (!p) return;
    pointsRef.current = p.points;
    distanceRef.current = p.distance;
    durationRef.current = p.duration;
    setPoints(p.points);
    setDistance(p.distance);
    setDuration(p.duration);
    setStatus("paused");
    setHasOrphan(false);
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

  // Auto-persist a cada 10 pontos (IndexedDB)
  useEffect(() => {
    if (status === "tracking" && points.length > 0 && points.length % 10 === 0) {
      persist("tracking");
    }
  }, [points.length, status, persist]);

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
    hasOrphan,
    start,
    pause,
    resume,
    finalize,
    discard,
    reset,
    restoreOrphan,
  };
}
