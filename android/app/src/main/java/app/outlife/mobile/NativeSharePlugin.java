package app.outlife.mobile;

import android.content.Intent;
import android.net.Uri;
import android.util.Base64;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;

/**
 * Plugin nativo próprio, escrito depois de 5 tentativas sucessivas de
 * corrigir o compartilhamento de arquivo encadeando dois plugins de
 * terceiros (`@capacitor/filesystem` para gravar o Blob em disco +
 * `@capacitor/share` para abrir a folha nativa). Todas as tentativas
 * anteriores erravam no mesmo ponto: o erro real nunca chegava ao
 * JavaScript de forma legível (a UI só via "Não foi possível
 * compartilhar", um texto genérico), então cada tentativa de correção era
 * um chute às cegas sobre qual das duas bibliotecas — e qual etapa dentro
 * de cada uma — estava de fato falhando.
 *
 * Este plugin substitui as duas dependências por UM único método Java
 * (`shareFile`), sem nenhuma biblioteca intermediária: grava o arquivo
 * diretamente em `context.getCacheDir()` (a mesma pasta já exposta ao
 * FileProvider em `file_paths.xml`, `<cache-path path="." />`), resolve a
 * URI via `FileProvider.getUriForFile` com a MESMA authority já declarada
 * no `AndroidManifest.xml` (`${applicationId}.fileprovider`, já usada pelo
 * upload de imagens), e dispara o Intent.ACTION_SEND diretamente — sem
 * `startActivityForResult`, então não há resultado de "cancelado" a
 * interpretar errado, e não há dependência de como duas bibliotecas
 * externas trocam o formato da URI entre si.
 *
 * Qualquer exceção real (permissão, I/O, FileProvider mal configurado,
 * etc.) é devolvida ao JS via `call.reject(mensagem real)` — visível tanto
 * no toast de erro (que agora inclui o texto da exceção) quanto no
 * console remoto (`chrome://inspect`, já habilitado em `onCreate`), em vez
 * de ficar escondida atrás de uma mensagem genérica.
 */
@CapacitorPlugin(name = "NativeShare")
public class NativeSharePlugin extends Plugin {

    @PluginMethod
    public void shareFile(PluginCall call) {
        String base64Data = call.getString("data");
        String fileName = call.getString("fileName");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        String title = call.getString("title");
        String text = call.getString("text");

        if (base64Data == null || fileName == null) {
            call.reject("Parâmetros 'data'/'fileName' ausentes.");
            return;
        }

        // Compartilhamento de link/texto puro (sem arquivo): `shareContent`
        // (share.ts) chama este método com `data`/`fileName` vazios quando
        // o conteúdo é uma URL, reaproveitando o mesmo Intent.ACTION_SEND
        // em vez de manter uma segunda dependência (@capacitor/share)
        // só para esse caso.
        boolean hasFile = !fileName.isEmpty();

        Uri fileUri = null;
        if (hasFile) {
            try {
                byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
                File outFile = new File(getContext().getCacheDir(), fileName);
                try (FileOutputStream out = new FileOutputStream(outFile)) {
                    out.write(bytes);
                }
                fileUri = FileProvider.getUriForFile(
                    getContext(),
                    getContext().getPackageName() + ".fileprovider",
                    outFile
                );
            } catch (Exception e) {
                call.reject("Falha ao gravar o arquivo para compartilhar: " + e.getMessage(), e);
                return;
            }
        }

        try {
            Intent sendIntent = new Intent(Intent.ACTION_SEND);
            sendIntent.setType(mimeType);
            if (fileUri != null) {
                sendIntent.putExtra(Intent.EXTRA_STREAM, fileUri);
                sendIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            }
            if (title != null) sendIntent.putExtra(Intent.EXTRA_SUBJECT, title);
            if (text != null) sendIntent.putExtra(Intent.EXTRA_TEXT, text);

            Intent chooser = Intent.createChooser(sendIntent, title);
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(chooser);

            JSObject result = new JSObject();
            result.put("value", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Falha ao abrir a folha de compartilhamento: " + e.getMessage(), e);
        }
    }
}
