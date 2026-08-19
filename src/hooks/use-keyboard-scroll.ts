import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * Dentro do Outlife_Native_Shell (Android, windowSoftInputMode=adjustNothing),
 * o teclado é overlay e não redimensiona a janela. Em Sheets e formulários
 * que ficam na parte inferior da tela, o campo focado pode ficar escondido
 * atrás do teclado.
 *
 * Este hook escuta o evento `focusin` e, quando o elemento focado é um
 * input/textarea dentro de um container scrollável, rola esse container
 * para que o campo fique visível acima do teclado estimado (~40% da tela).
 *
 * Só ativo em plataforma nativa (Capacitor). No browser, o comportamento
 * padrão de scroll já funciona (ou adjustResize está ativo).
 */
export function useKeyboardScroll() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handler = (e: FocusEvent) => {
      const target = e.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;

      // Aguarda o teclado abrir (~300ms no Android) antes de scrollar
      setTimeout(() => {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 350);
    };

    document.addEventListener("focusin", handler, { passive: true });
    return () => document.removeEventListener("focusin", handler);
  }, []);
}
