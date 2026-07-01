import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  updateChecklist,
  type ChecklistItem,
  type UserChecklist,
} from "@/lib/api";

/**
 * Encapsula edição de itens de um checklist com:
 * - Optimistic update no cache (UI instantânea)
 * - Debounce de 400ms agrupando alterações consecutivas
 * - Rollback automático em caso de erro
 */
export function useChecklistMutations(checklistId: string) {
  const qc = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingItemsRef = useRef<ChecklistItem[] | null>(null);
  const lastSyncedRef = useRef<ChecklistItem[] | null>(null);

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const items = pendingItemsRef.current;
    if (!items) return;
    const previous = lastSyncedRef.current;
    pendingItemsRef.current = null;
    try {
      const saved = await updateChecklist(checklistId, { items });
      lastSyncedRef.current = saved.items;
      qc.setQueryData<UserChecklist | null>(["checklist", checklistId], saved);
      qc.invalidateQueries({ queryKey: ["user-checklists"] });
    } catch (err) {
      // rollback otimista
      if (previous) {
        qc.setQueryData<UserChecklist | null>(
          ["checklist", checklistId],
          (prev) => (prev ? { ...prev, items: previous } : prev),
        );
      }
      toast.error((err as Error).message);
    }
  }, [checklistId, qc]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        // tenta salvar pendente ao desmontar
        if (pendingItemsRef.current) {
          updateChecklist(checklistId, { items: pendingItemsRef.current }).catch(() => {});
        }
      }
    };
  }, [checklistId]);

  const queueItems = useCallback(
    (nextItems: ChecklistItem[]) => {
      // captura snapshot para rollback
      const current = qc.getQueryData<UserChecklist | null>(["checklist", checklistId]);
      if (current && lastSyncedRef.current === null) {
        lastSyncedRef.current = current.items;
      }
      // optimistic update
      qc.setQueryData<UserChecklist | null>(["checklist", checklistId], (prev) =>
        prev ? { ...prev, items: nextItems } : prev,
      );
      pendingItemsRef.current = nextItems;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void flush();
      }, 400);
    },
    [checklistId, qc, flush],
  );

  return { queueItems, flush };
}
