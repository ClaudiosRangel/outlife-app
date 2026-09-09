import { CloudUpload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSyncQueueSize } from "@/hooks/use-sync-queue-size";

/**
 * StatusBar — antes exibia elementos DECORATIVOS que imitavam a barra do
 * sistema (hora "9:41", três pontinhos, bateria "100%"). No app nativo o
 * Android/iOS já mostram a barra de status real em cima, tornando o mock
 * redundante — foi removido (pedido do usuário).
 *
 * O que permanece é o ÚNICO indicador REAL desta barra: um aviso de
 * sincronização pendente (Activity_Sync_Queue) quando há atividades ainda não
 * enviadas. Quando não há nada pendente, a barra não renderiza nada — só um
 * pequeno espaçador para preservar o respiro do topo das telas.
 */
export function StatusBar({ light = false }: { light?: boolean }) {
  const { t } = useTranslation();
  const { size, isPending } = useSyncQueueSize();

  if (!isPending) {
    // Sem nada real a mostrar: apenas um espaçador leve (mantém o layout).
    return <div className="pt-2" />;
  }

  return (
    <div className={`flex items-center justify-end px-6 pt-3 pb-1 text-[12px] font-semibold tracking-tight ${light ? "text-white" : "text-foreground"}`}>
      <span
        className="flex items-center gap-1"
        title={t("activity.syncQueuePending", { count: size })}
        aria-label={t("activity.syncQueuePending", { count: size })}
      >
        <CloudUpload size={13} className="animate-pulse" />
        <span className="text-[11px]">{size}</span>
      </span>
    </div>
  );
}
