import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import ptBR from "../../public/locales/pt-BR/translation.json";
import en from "../../public/locales/en/translation.json";

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        "pt-BR": { translation: ptBR },
        en: { translation: en },
      },
      fallbackLng: "pt-BR",
      lng: "pt-BR",
      interpolation: { escapeValue: false },
    });
}

export default i18n;
