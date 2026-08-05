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

/** Tempo máximo (ms) permitido para cada tentativa de sincronização de um item da fila (Requirement 5.2). */
const SYNC_TIMEOUT_MS = 15_000;

/**
 * Corre `p` contra um temporizador de `ms` milissegundos: resolve/rejeita
 * com o desfecho de `p` se ela concluir primeiro, ou rejeita com um erro de
 * timeout se o prazo for excedido primeiro — tratado como falha comum pelo
 * chamador (mantém o item na fila, incrementa `attempts`), sem tratamento
 * especial (Requirement 5.3).
 */
async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Timeout após ${ms}ms`)), ms)),
  ]);
}

export type ActivePersisted = {
  points: TrackPoint[];
  distance: number;
  duration: number;
  status: TrackerStatus;
  updatedAt: number;
  /** ID do registro no Supabase (user_activities), para retomar/finalizar após navegação */
  activityId?: string | null;
  /** Tipo de atividade selecionado */
  activityType?: string | null;
};

/**
 * Sinaliza que os dados persistidos de uma atividade ativa existem mas
 * estão corrompidos (schema inválido) ou não puderam ser lidos — estado
 * "não recuperável" (Requirement 3.4). Nunca contém distância, duração ou
 * trajeto derivados dos dados corrompidos.
 */
export type CorruptedActive = { corrupted: true };

const TRACKER_STATUSES: readonly TrackerStatus[] = ["idle", "tracking", "paused", "saving"];

function isValidTrackPoint(value: unknown): value is TrackPoint {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as TrackPoint).lat === "number" &&
    Number.isFinite((value as TrackPoint).lat) &&
    typeof (value as TrackPoint).lng === "number" &&
    Number.isFinite((value as TrackPoint).lng) &&
    typeof (value as TrackPoint).ts === "number" &&
    Number.isFinite((value as TrackPoint).ts)
  );
}

/**
 * Valida o formato de um `ActivePersisted` lido do armazenamento local.
 * Retorna `true` somente quando `points`/`distance`/`duration`/`status`
 * têm exatamente o formato esperado — nunca aceita dados parciais.
 */
function isValidActivePersisted(value: unknown): value is ActivePersisted {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Partial<ActivePersisted>;
  return (
    Array.isArray(v.points) &&
    v.points.every(isValidTrackPoint) &&
    typeof v.distance === "number" &&
    Number.isFinite(v.distance) &&
    typeof v.duration === "number" &&
    Number.isFinite(v.duration) &&
    typeof v.status === "string" &&
    (TRACKER_STATUSES as readonly string[]).includes(v.status)
  );
}

export async function loadActive(): Promise<ActivePersisted | CorruptedActive | null> {
  try {
    const raw = await activeStore.getItem<unknown>(ACTIVE_KEY);
    if (raw == null) return null;
    if (!isValidActivePersisted(raw)) return { corrupted: true };
    return raw;
  } catch {
    // Dados existentes que não puderam ser lidos também são
    // "não recuperáveis" (Requirement 3.4) — distinto de "sem atividade
    // ativa" (null), que só ocorre quando não há registro nenhum.
    return { corrupted: true };
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

/**
 * Enfileira uma User_Activity finalizada localmente para sincronização
 * posterior. Tenta a operação de escrita em `queueStore` até 3 vezes
 * (Requirement 5.9); só lança após a 3ª falha, para a UI chamadora exibir
 * uma mensagem indicando que os dados da atividade podem não ter sido
 * salvos.
 */
export async function enqueueActivity(a: Omit<QueuedActivity, "attempts">): Promise<void> {
  const MAX_ENQUEUE_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ENQUEUE_ATTEMPTS; attempt++) {
    try {
      await queueStore.setItem(a.localId, { ...a, attempts: 0 });
      return;
    } catch (e) {
      if (attempt === MAX_ENQUEUE_ATTEMPTS) throw e;
    }
  }
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
        const created = await withTimeout(startActivity(item.destinationId ?? null), SYNC_TIMEOUT_MS);
        remoteId = created.id;
      }
      await withTimeout(
        finishActivity(remoteId!, {
          distance_meters: item.distance_meters,
          duration_seconds: item.duration_seconds,
          route_geojson: item.route_geojson,
        }),
        SYNC_TIMEOUT_MS,
      );
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
