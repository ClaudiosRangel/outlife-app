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
  // Nota: a pasta ios/ foi gerada com CocoaPods (via
  // `npx cap add ios --packagemanager CocoaPods`), e NÃO com o SPM padrão do
  // Capacitor 8. Motivo: o plugin nativo @outlife/capacitor-location-tracking
  // fornece integração só via .podspec (CocoaPods), não via Package.swift —
  // com SPM o rastreamento (função central do app) ficava de fora do build
  // iOS. Com CocoaPods os 3 plugins (app, push, location-tracking) entram
  // juntos. O escolha de package manager é feita no `cap add`, não neste
  // config (não há campo para isso no CapacitorConfig).
};

export default config;
