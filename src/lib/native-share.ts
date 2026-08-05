import { registerPlugin } from "@capacitor/core";

/**
 * Wrapper TypeScript do plugin nativo Android `NativeSharePlugin`
 * (`android/app/src/main/java/app/outlife/mobile/NativeSharePlugin.java`).
 *
 * `registerPlugin` do `@capacitor/core` funciona tanto para plugins
 * distribuídos como pacote npm (como `@outlife/capacitor-location-tracking`)
 * quanto para plugins registrados diretamente na Activity do app via
 * `registerPlugin(NativeSharePlugin.class)` (ver MainActivity.java) — não é
 * necessário um pacote npm separado para este caso, já que o plugin só
 * precisa existir na plataforma Android deste app específico.
 */
interface NativeSharePlugin {
  shareFile(options: {
    data: string; // conteúdo do arquivo em base64 (sem prefixo data:...)
    fileName: string;
    mimeType: string;
    title?: string;
    text?: string;
  }): Promise<{ value: boolean }>;
}

export const NativeShare = registerPlugin<NativeSharePlugin>("NativeShare");
