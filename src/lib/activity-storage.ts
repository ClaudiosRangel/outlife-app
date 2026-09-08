import localforage from "localforage";
import type { TrackPoint, TrackerStatus } from "@/hooks/use-activity-tracker";
import { finishActivity, startActivity, uploadActivityMapSnapshot, type ActivityType } from "@/lib/api";

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
  /**
   * Ganho de elevação acumulado (metros, só subidas). Opcional na validação
   * para retrocompatibilidade: registros antigos sem o campo são tratados
   * como `0` e permanecem válidos (Requirement 1.4).
   */
  elevationGain: number;
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
  // `elevationGain` é opcional para retrocompatibilidade: registros antigos
  // gravados antes desta mudança não têm o campo e NÃO devem ser invalidados
  // (ausência é tratada como `0`). Quando presente, deve ser número finito
  // >= 0 (Requirement 1.4).
  const elevationGainOk =
    v.elevationGain === undefined ||
    (typeof v.elevationGain === "number" && Number.isFinite(v.elevationGain) && v.elevationGain >= 0);
  return (
    Array.isArray(v.points) &&
    v.points.every(isValidTrackPoint) &&
    typeof v.distance === "number" &&
    Number.isFinite(v.distance) &&
    typeof v.duration === "number" &&
    Number.isFinite(v.duration) &&
    elevationGainOk &&
    typeof v.status === "string" &&
    (TRACKER_STATUSES as readonly string[]).includes(v.status)
  );
}

export async function loadActive(): Promise<ActivePersisted | CorruptedActive | null> {
  try {
    const raw = await activeStore.getItem<unknown>(ACTIVE_KEY);
    if (raw == null) return null;
    if (!isValidActivePersisted(raw)) return { corrupted: true };
    // Normaliza a ausência de `elevationGain` (registros antigos) para `0`,
    // garantindo que o consumidor sempre receba um número (Requirement 1.4).
    return { ...raw, elevationGain: raw.elevationGain ?? 0 };
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
  /** Tipo da atividade, preservado para o fluxo offline (Requirement 2.1). */
  activity_type?: ActivityType | null;
  /** Ganho de elevação acumulado (metros), preservado no fluxo offline (Requirement 1.4). */
  elevation_gain?: number | null;
  /**
   * Snapshot do mapa (WebP) pendente de upload. `localforage` (IndexedDB)
   * serializa `Blob` nativamente, então o snapshot fica guardado na fila e é
   * enviado apenas na sincronização (Requirement 2.2).
   */
  map_snapshot_blob?: Blob | null;
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
        // Req 2.3: preserva o Activity_Type ao criar a atividade no sync.
        const created = await withTimeout(
          startActivity(item.destinationId ?? null, item.activity_type ?? null),
          SYNC_TIMEOUT_MS,
        );
        remoteId = created.id;
      }

      // Req 2.4/2.5: upload do snapshot pendente, isolado em try interno —
      // uma falha (exceção ou timeout) deixa o snapshot ausente mas NÃO
      // bloqueia a sincronização da atividade.
      let map_snapshot_url: string | undefined;
      if (item.map_snapshot_blob) {
        try {
          map_snapshot_url = await withTimeout(
            uploadActivityMapSnapshot(item.map_snapshot_blob),
            SYNC_TIMEOUT_MS,
          );
        } catch {
          // snapshot fica ausente; a sincronização da atividade prossegue.
        }
      }

      await withTimeout(
        finishActivity(remoteId!, {
          distance_meters: item.distance_meters,
          duration_seconds: item.duration_seconds,
          route_geojson: item.route_geojson,
          activity_type: item.activity_type ?? null, // Req 2.3
          elevation_gain: item.elevation_gain ?? null, // Req 1.4
          map_snapshot_url, // Req 2.4 (undefined quando ausente/falhou)
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
