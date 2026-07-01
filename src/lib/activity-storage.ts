import localforage from "localforage";
import type { TrackPoint, TrackerStatus } from "@/hooks/use-activity-tracker";
import { finishActivity, startActivity } from "@/lib/api";

const activeStore = localforage.createInstance({
  name: "outlife",
  storeName: "active_activity",
  description: "Atividade GPS em andamento",
});

const queueStore = localforage.createInstance({
  name: "outlife",
  storeName: "sync_queue",
  description: "Atividades aguardando sincronização",
});

const ACTIVE_KEY = "current";

export type ActivePersisted = {
  points: TrackPoint[];
  distance: number;
  duration: number;
  status: TrackerStatus;
  updatedAt: number;
};

export async function loadActive(): Promise<ActivePersisted | null> {
  try {
    return (await activeStore.getItem<ActivePersisted>(ACTIVE_KEY)) ?? null;
  } catch {
    return null;
  }
}

export async function saveActive(p: ActivePersisted): Promise<void> {
  try {
    await activeStore.setItem(ACTIVE_KEY, p);
  } catch {
    /* noop */
  }
}

export async function clearActive(): Promise<void> {
  try {
    await activeStore.removeItem(ACTIVE_KEY);
  } catch {
    /* noop */
  }
}

export type QueuedActivity = {
  localId: string;
  remoteId?: string | null;
  destinationId?: string | null;
  startTime: string;
  endTime: string;
  distance_meters: number;
  duration_seconds: number;
  route_geojson: GeoJSON.LineString;
  attempts: number;
  lastError?: string;
};

export async function enqueueActivity(a: Omit<QueuedActivity, "attempts">): Promise<void> {
  await queueStore.setItem(a.localId, { ...a, attempts: 0 });
}

export async function removeFromQueue(localId: string): Promise<void> {
  await queueStore.removeItem(localId);
}

export async function listQueued(): Promise<QueuedActivity[]> {
  const out: QueuedActivity[] = [];
  await queueStore.iterate<QueuedActivity, void>((value) => {
    out.push(value);
  });
  return out;
}

/**
 * Tenta sincronizar todas as atividades na fila com o Supabase.
 * Retorna número de itens sincronizados com sucesso.
 */
export async function flushQueue(): Promise<{ synced: number; failed: number }> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { synced: 0, failed: 0 };
  }
  const items = await listQueued();
  let synced = 0;
  let failed = 0;
  for (const item of items) {
    try {
      let remoteId = item.remoteId;
      if (!remoteId) {
        const created = await startActivity(item.destinationId ?? null);
        remoteId = created.id;
      }
      await finishActivity(remoteId!, {
        distance_meters: item.distance_meters,
        duration_seconds: item.duration_seconds,
        route_geojson: item.route_geojson,
      });
      await removeFromQueue(item.localId);
      synced += 1;
    } catch (e) {
      failed += 1;
      await queueStore.setItem(item.localId, {
        ...item,
        attempts: item.attempts + 1,
        lastError: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return { synced, failed };
}
