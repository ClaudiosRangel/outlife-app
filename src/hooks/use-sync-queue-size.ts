import { useEffect, useState } from "react";
import { listQueued } from "@/lib/activity-storage";

const POLL_INTERVAL_MS = 5_000;

export type SyncQueueSizeState = {
  size: number;
  isPending: boolean;
};

/**
 * Hook que expõe o tamanho atual da Activity_Sync_Queue (`listQueued().length`)
 * para alimentar o indicador visual de fila pendente (Requirement 5.6).
 *
 * Faz uma leitura imediata ao montar e, enquanto a fila não estiver vazia,
 * um polling leve a cada 5s (`POLL_INTERVAL_MS`) — o polling é interrompido
 * automaticamente assim que a fila esvaziar, evitando checagens
 * desnecessárias enquanto não há nada pendente.
 */
export function useSyncQueueSize(): SyncQueueSizeState {
  const [size, setSize] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const items = await listQueued();
        if (!cancelled) {
          setSize(items.length);
        }
      } catch {
        /* silencioso — mantém o último tamanho conhecido */
      }
    };

    void check();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (size === 0) {
      return;
    }

    let cancelled = false;
    const interval = setInterval(() => {
      void (async () => {
        try {
          const items = await listQueued();
          if (!cancelled) {
            setSize(items.length);
          }
        } catch {
          /* silencioso — mantém o último tamanho conhecido */
        }
      })();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [size]);

  return { size, isPending: size > 0 };
}
