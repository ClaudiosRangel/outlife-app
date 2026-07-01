import { useEffect } from "react";
import { toast } from "sonner";
import { flushQueue } from "@/lib/activity-storage";

/**
 * Tenta sincronizar a fila de atividades offline ao montar e quando a conexão volta.
 */
export function useActivitySync() {
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const { synced } = await flushQueue();
        if (!cancelled && synced > 0) {
          toast.success(
            synced === 1
              ? "1 atividade offline sincronizada."
              : `${synced} atividades offline sincronizadas.`,
          );
        }
      } catch {
        /* silencioso */
      }
    };

    void run();
    window.addEventListener("online", run);
    return () => {
      cancelled = true;
      window.removeEventListener("online", run);
    };
  }, []);
}
