import { CloudUpload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSyncQueueSize } from "@/hooks/use-sync-queue-size";

export function StatusBar({ light = false }: { light?: boolean }) {
  const { t } = useTranslation();
  // Requirement 5.6: enquanto a Activity_Sync_Queue contém ao menos uma
  // User_Activity pendente de sincronização, exibe uma indicação visual
  // desse estado. StatusBar é renderizado em praticamente todas as telas
  // autenticadas, tornando-o um bom ponto global para esse indicador.
  const { size, isPending } = useSyncQueueSize();

  return (
    <div className={`flex items-center justify-between px-6 pt-3 pb-1 text-[12px] font-semibold tracking-tight ${light ? "text-white" : "text-foreground"}`}>
      <span>9:41</span>
      <div className="flex items-center gap-1 opacity-90">
        {isPending && (
          <span
            className="mr-1 flex items-center gap-1"
            title={t("activity.syncQueuePending", { count: size })}
            aria-label={t("activity.syncQueuePending", { count: size })}
          >
            <CloudUpload size={13} className="animate-pulse" />
          </span>
        )}
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        <span className="ml-2 text-[11px]">100%</span>
      </div>
    </div>
  );
}
