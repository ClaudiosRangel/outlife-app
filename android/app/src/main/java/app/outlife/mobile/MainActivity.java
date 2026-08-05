package app.outlife.mobile;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebView;
import android.webkit.WebSettings;

import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;

import com.getcapacitor.BridgeActivity;
import com.outlife.capacitorlocationtracking.LocationTrackingPlugin;

public class MainActivity extends BridgeActivity {
    // A partir do Android 15 (API 35+), o sistema força o app a desenhar
    // edge-to-edge por padrão, o que quebra o redimensionamento da WebView
    // ao abrir o teclado (windowSoftInputMode="adjustResize" deixa de
    // funcionar sozinho) — a tela inteira era deslocada para cima em vez
    // de a WebView encolher, empurrando os campos de formulário para fora
    // da área visível. Desativar explicitamente o layout edge-to-edge
    // restaura o comportamento clássico de "resize", compatível com o
    // layout do app (que não trata insets de sistema manualmente) e com o
    // plugin @capacitor/keyboard (ver src/routes/__root.tsx).
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin nativo próprio do compartilhamento de arquivo (banners de
        // atividade/comunidade) — ver NativeSharePlugin.java para o
        // histórico completo do bug que motivou substituir
        // @capacitor/filesystem + @capacitor/share por esta implementação
        // direta. registerPlugin() precisa ser chamado antes de
        // super.onCreate() (padrão do Capacitor).
        registerPlugin(NativeSharePlugin.class);
        registerPlugin(LocationTrackingPlugin.class);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            getWindow().setDecorFitsSystemWindows(true);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        }
        // Habilita a inspeção remota da WebView via chrome://inspect no
        // Chrome desktop (cabo USB + depuração USB no celular), permitindo
        // ver o console/erros reais do JS em vez de investigar às ciegas.
        // TEMPORÁRIO para diagnóstico: remover antes de uma build de
        // release (expõe o conteúdo da WebView a qualquer app com acesso
        // USB debug).
        WebView.setWebContentsDebuggingEnabled(true);
        super.onCreate(savedInstanceState);

        // Bug diagnosticado com o usuário: colar texto ou tocar numa
        // sugestão do teclado travava indefinidamente qualquer campo de
        // formulário — reproduzido tanto no celular físico (Android 10)
        // quanto no BlueStacks, mas NUNCA no Chrome normal acessando o
        // mesmo site publicado. Essa assinatura (funciona no Chrome,
        // trava só na WebView embutida, exatamente nas duas ações que
        // disparam verificação de conteúdo — colar e selecionar sugestão)
        // é uma incompatibilidade conhecida entre o Android Autofill
        // Framework (serviço do sistema que sugere preencher e-mail/senha
        // salvos) e WebViews embutidas em apps: o Chrome trata Autofill
        // de forma otimizada, mas uma WebView "crua" pode travar a thread
        // principal esperando essa interação. Desativar Autofill
        // explicitamente nesta View (e em toda a árvore de descendentes,
        // incluindo o próprio WebView do Capacitor) remove esse gatilho.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getWindow().getDecorView().setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
            View webView = getBridge().getWebView();
            if (webView != null) {
                webView.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
            }
        }

        // Bug reportado pelo usuário: ao digitar nos campos E-mail/Senha da
        // tela de login (e potencialmente qualquer outro <input> do app), o
        // texto digitado não aparece — mas o placeholder/label continuam
        // visíveis normalmente. Causa raiz: com o celular no modo escuro do
        // sistema, o WebView do Android aplica "Force Dark"/Algorithmic
        // Darkening automaticamente sobre o conteúdo web (a partir do
        // Android 10, WebView >= 82) quando a página não declara suporte
        // explícito a temas — reescrevendo cor de fundo/texto de forma
        // inconsistente, o que é uma causa conhecida de texto digitado
        // ficar da mesma cor do fundo em <input>. O app nunca ativa sua
        // própria classe `.dark` (ver src/styles.css), então deve sempre
        // renderizar no tema claro original — desativamos explicitamente o
        // algoritmo de escurecimento automático da WebView para que ela
        // nunca reescreva as cores por fora do controle do CSS do app.
        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
            View webViewForTheme = getBridge().getWebView();
            if (webViewForTheme instanceof WebView) {
                WebSettings settings = ((WebView) webViewForTheme).getSettings();
                WebSettingsCompat.setAlgorithmicDarkeningAllowed(settings, false);
            }
        }
    }
}
