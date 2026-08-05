import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { NativeShare } from "@/lib/native-share";
import i18n from "@/lib/i18n";

export type ShareContentInput =
  | { title?: string; text?: string; url: string }
  | { title?: string; text?: string; file: Blob; fileName: string };

function isFileShareInput(
  data: ShareContentInput
): data is { title?: string; text?: string; file: Blob; fileName: string } {
  return "file" in data;
}

/**
 * Aciona o download de `file` via um elemento `<a download>` temporário e
 * exibe um toast de confirmação. Usado apenas fora do
 * Outlife_Native_Shell (navegador comum), onde a técnica funciona de
 * verdade — dentro do WebView nativo o compartilhamento passa por
 * `NativeShare` (ver `shareFileNatively`), nunca por aqui.
 */
function downloadFile(file: File): void {
  const objectUrl = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
  toast.success(i18n.t("common.downloaded"));
}

/** Converte um Blob em string base64 (sem o prefixo `data:...;base64,`). */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Resultado de `shareFileNatively`: distingue os desfechos para a UI
 * decidir a mensagem exibida. `message` carrega o texto real do erro
 * (devolvido pelo plugin nativo) para diagnóstico, em vez de uma mensagem
 * genérica que escondia a causa.
 */
type NativeFileShareResult = { status: "shared" } | { status: "failed"; message: string };

/**
 * HISTÓRICO DO BUG (5 tentativas anteriores, todas no mesmo sintoma: o
 * botão de compartilhar em Atividade/Comunidade sempre mostrava "Arquivo
 * baixado!" ou "Não foi possível compartilhar", sem nunca resolver de
 * fato). As tentativas anteriores encadeavam dois plugins Capacitor de
 * terceiros — `@capacitor/filesystem` (gravar o Blob em disco) e
 * `@capacitor/share` (abrir a folha nativa) — e cada correção era uma
 * suposição sobre qual das duas bibliotecas, e qual etapa dentro de cada
 * uma, estava de fato falhando, porque o erro real nunca chegava
 * legível ao JavaScript.
 *
 * CORREÇÃO DE RAIZ: as duas dependências foram substituídas por um plugin
 * nativo Android escrito diretamente neste projeto —
 * `android/app/src/main/java/app/outlife/mobile/NativeSharePlugin.java`
 * (wrapper TS em `src/lib/native-share.ts`). Um único método Java grava o
 * arquivo em `context.getCacheDir()`, resolve a URI via
 * `FileProvider.getUriForFile` (mesma authority já usada pelo upload de
 * imagens) e dispara `Intent.ACTION_SEND` diretamente, sem
 * `startActivityForResult` (elimina a ambiguidade de interpretar
 * "cancelado" vs. erro real) e sem depender de como duas bibliotecas
 * externas trocam o formato da URI entre si. Qualquer exceção real é
 * devolvida como texto pelo próprio plugin (`err.message`), permitindo
 * diagnosticar a causa exata caso volte a falhar.
 */
async function shareFileNatively(file: File, title?: string, text?: string): Promise<NativeFileShareResult> {
  try {
    const base64Data = await blobToBase64(file);
    await NativeShare.shareFile({
      data: base64Data,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      title,
      text,
    });
    return { status: "shared" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[OutLife] Falha ao compartilhar arquivo nativamente:", err);
    return { status: "failed", message };
  }
}

/**
 * Compartilhamento nativo/clipboard (Requirement 12.5) e de arquivos
 * (Requirement 7.6).
 *
 * WHEN o botão de compartilhar em um Community_Post ou no topo da galeria de
 * `/parceiro/$partnerId` é selecionado, THE OutLife_Application SHALL abrir
 * um mecanismo de compartilhamento nativo do navegador ou copiar o link
 * correspondente para a área de transferência, com confirmação visível ao
 * usuário.
 *
 * Quando `data` contém `file`/`fileName` (ex.: banner de atividade/post
 * gerado via canvas): dentro do Outlife_Native_Shell, usa o plugin
 * `NativeShare` próprio (ver `shareFileNatively`); fora dele (navegador
 * comum), tenta `navigator.share({ files })` e cai para download via
 * `<a download>` se indisponível.
 *
 * Quando `data` contém `url`, tenta o compartilhamento nativo
 * (`@capacitor/share`... nota: removido — ver abaixo) ou `navigator.share`
 * primeiro. Se indisponível, ou se a chamada falhar por qualquer motivo
 * que não seja o usuário cancelar, cai para
 * `navigator.clipboard.writeText(url)`.
 *
 * Em ambos os casos de sucesso exibe um `toast` de confirmação; em falha de
 * ambos os mecanismos, exibe um `toast` de erro com o motivo real quando
 * disponível. Cancelamento pelo usuário não gera nenhum toast.
 */
export async function shareContent(data: ShareContentInput): Promise<void> {
  const isNative = Capacitor.isNativePlatform();

  if (isFileShareInput(data)) {
    const file = new File([data.file], data.fileName, { type: data.file.type });

    if (isNative) {
      const result = await shareFileNatively(file, data.title, data.text);
      if (result.status === "shared") {
        toast.success(i18n.t("common.shared"));
      } else {
        toast.error(`${i18n.t("common.shareError")} (${result.message})`);
      }
      return;
    }

    const canShareFiles =
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] });

    if (canShareFiles) {
      try {
        await navigator.share({ files: [file], title: data.title, text: data.text });
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
      downloadFile(file);
    } catch {
      toast.error(i18n.t("common.shareError"));
    }
    return;
  }

  // Compartilhamento de URL/texto: dentro do shell nativo, reaproveita o
  // mesmo Intent.ACTION_SEND do NativeShare, sem arquivo (mimeType
  // "text/plain" e o link embutido no texto compartilhado) — elimina a
  // segunda dependência (`@capacitor/share`) por completo, mesma causa
  // raiz do bug de arquivo.
  if (isNative) {
    try {
      const combinedText = data.text ? `${data.text} ${data.url}` : data.url;
      await NativeShare.shareFile({
        data: "",
        fileName: "",
        mimeType: "text/plain",
        title: data.title,
        text: combinedText,
      });
      toast.success(i18n.t("common.shared"));
      return;
    } catch (err) {
      console.error("[OutLife] Falha ao compartilhar link nativamente:", err);
      // Cai para o fallback de clipboard abaixo.
    }
  } else if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
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
