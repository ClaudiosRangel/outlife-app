import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import logoOutvitar from "@/assets/logo-outvitar.png";

/**
 * Splash de marca em React — cobre a tela ao abrir o app com a logo grande +
 * slogan sobre o fundo verde da marca, e some suavemente após ~1,8s.
 *
 * Complementa o splash nativo (imagem estática do Capacitor que aparece antes
 * do WebView carregar): quando o React monta, este componente assume, dando
 * controle total de layout (logo bem maior + slogan), como o usuário pediu.
 *
 * Só é exibido uma vez por carga do app (não a cada navegação).
 */
export function BrandSplash() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(true);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    // Inicia o fade-out perto do fim e desmonta ao terminar a transição.
    const fadeTimer = setTimeout(() => setFadingOut(true), 1500);
    const hideTimer = setTimeout(() => setVisible(false), 2000);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-forest transition-opacity duration-500 ${
        fadingOut ? "opacity-0" : "opacity-100"
      }`}
      aria-hidden="true"
    >
      <img
        src={logoOutvitar}
        alt="OutVitar"
        className="w-48 max-w-[60vw] object-contain drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)] animate-float-up"
        width={512}
        height={512}
      />
      <p className="mt-6 px-8 text-center font-display text-lg font-semibold uppercase tracking-wide text-white/95">
        {t("brand.slogan")}
      </p>
      <p className="mt-2 text-[11px] uppercase tracking-[0.3em] text-white/60">OutVitar</p>
    </div>
  );
}
