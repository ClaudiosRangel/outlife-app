import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Configuração do Outlife_Native_Shell (Capacitor), empacotando o resultado
 * do SPA_Build_Target (`npm run build:native` → `dist/native-spa`) no
 * WebView nativo Android/iOS (Requirements 1.3, 2.1 do spec
 * app-hibrido-nativo).
 */
const config: CapacitorConfig = {
  appId: "app.outlife.mobile",
  appName: "Outlife",
  webDir: "dist/native-spa",
  server: {
    androidScheme: "https",
  },
};

export default config;
