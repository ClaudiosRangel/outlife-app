import { toast } from "sonner";
import i18n from "@/lib/i18n";

export type ShareContentInput = {
  title?: string;
  text?: string;
  url: string;
};

/**
 * Compartilhamento nativo/clipboard (Requirement 12.5).
 *
 * WHEN o botão de compartilhar em um Community_Post ou no topo da galeria de
 * `/parceiro/$partnerId` é selecionado, THE OutLife_Application SHALL abrir
 * um mecanismo de compartilhamento nativo do navegador ou copiar o link
 * correspondente para a área de transferência, com confirmação visível ao
 * usuário.
 *
 * Tenta `navigator.share` primeiro. Se indisponível, ou se a chamada falhar
 * por qualquer motivo que não seja o usuário cancelar (`AbortError`), cai
 * para `navigator.clipboard.writeText(url)`. Em ambos os casos de sucesso
 * exibe um `toast` de confirmação; em falha de ambos os mecanismos, exibe um
 * `toast` de erro. Cancelamento pelo usuário (`AbortError`) não gera nenhum
 * toast.
 */
export async function shareContent(data: ShareContentInput): Promise<void> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share(data);
      toast.success(i18n.t("common.shared"));
      return;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // Usuário cancelou o compartilhamento nativo: não é uma falha.
        return;
      }
      // Qualquer outro erro do navigator.share cai para o fallback abaixo.
    }
  }

  try {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      throw new Error("Clipboard indisponível");
    }
    await navigator.clipboard.writeText(data.url);
    toast.success(i18n.t("common.linkCopied"));
  } catch {
    toast.error(i18n.t("common.shareError"));
  }
}
