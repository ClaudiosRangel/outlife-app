import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Configuração do Outlife_Native_Shell (Capacitor), empacotando o resultado
 * do SPA_Build_Target (`npm run build:native` → `dist/native-spa`) no
 * WebView nativo Android/iOS (Requirements 1.3, 2.1 do spec
 * app-hibrido-nativo).
 */
const config: CapacitorConfig = {
  // appId técnico MANTIDO como app.outlife.mobile por decisão do usuário:
  // trocá-lo exigiria re-registrar o app no Firebase (google-services.json),
  // ajustar deep links (assetlinks.json) e demais configs de backend. O
  // rebranding OutVitar é só de nome exibido no front. appName é o rótulo
  // sob o ícone — pode ser "OutVitar" sem quebrar nada.
  appId: "app.outlife.mobile",
  appName: "OutVitar",
  webDir: "dist/native-spa",
  server: {
    androidScheme: "https",
  },
};

export default config;
