import i18next from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import { resources } from "@/lib/i18n/resources";
import type { SupportedLang } from "@/lib/i18n/lang";

const i18n = i18next.createInstance();

const initPromise = i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: resources as any,
    fallbackLng: "zh",
    supportedLngs: Object.keys(resources) as SupportedLang[],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"]
    }
  });

export default Object.assign(i18n, { initPromise });
