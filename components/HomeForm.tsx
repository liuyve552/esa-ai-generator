"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

const LANGS = [
  { value: "auto", labelKey: "lang.auto" },
  { value: "en", labelKey: "lang.en" },
  { value: "zh", labelKey: "lang.zh" },
  { value: "ja", labelKey: "lang.ja" },
  { value: "ko", labelKey: "lang.ko" },
  { value: "es", labelKey: "lang.es" },
  { value: "fr", labelKey: "lang.fr" }
] as const;

export default function HomeForm() {
  const router = useRouter();
  const { t, i18n } = useTranslation();

  const [prompt, setPrompt] = useState<string>("");
  const [lang, setLang] = useState<string>("auto");

  const autoLang = useMemo(() => {
    const v = (i18n.resolvedLanguage ?? i18n.language ?? "en").toLowerCase();
    return v.split("-")[0] ?? "en";
  }, [i18n.language, i18n.resolvedLanguage]);

  const effectiveLang = useMemo(() => (lang === "auto" ? autoLang : lang), [lang, autoLang]);

  useEffect(() => {
    if (effectiveLang && i18n.language !== effectiveLang) {
      void i18n.changeLanguage(effectiveLang);
    }
  }, [effectiveLang, i18n]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="rounded-3xl border border-black/10 bg-white/70 p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_20px_60px_rgba(0,0,0,0.12)] backdrop-blur dark:border-white/10 dark:bg-white/5 dark:shadow-glow"
    >
      <div className="space-y-2">
        <h2 className="text-lg font-semibold md:text-xl">{t("home.title")}</h2>
        <p className="text-sm text-black/70 dark:text-white/70">{t("home.subtitle")}</p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-[1fr_180px]">
        <label className="space-y-2">
          <span className="text-xs text-black/60 dark:text-white/60">{t("home.promptLabel")}</span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t("home.promptPlaceholder")}
            className="min-h-[112px] w-full resize-none rounded-2xl border border-black/10 bg-white p-4 text-sm text-black outline-none ring-0 placeholder:text-black/40 focus:border-black/20 focus:bg-white dark:border-white/10 dark:bg-black/40 dark:text-white dark:placeholder:text-white/40 dark:focus:border-white/25 dark:focus:bg-black/55"
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs text-black/60 dark:text-white/60">{t("home.langLabel")}</span>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="h-[46px] w-full rounded-2xl border border-black/10 bg-white px-3 text-sm text-black outline-none focus:border-black/20 dark:border-white/10 dark:bg-black/40 dark:text-white dark:focus:border-white/25"
          >
            {LANGS.map((l) => (
              <option key={l.value} value={l.value}>
                {t(l.labelKey)}
              </option>
            ))}
          </select>

          <button
            onClick={() => router.push(`/result/?prompt=${encodeURIComponent(prompt)}&lang=${encodeURIComponent(effectiveLang)}`)}
            disabled={!prompt.trim()}
            className="mt-2 h-[46px] w-full rounded-2xl bg-black px-4 text-sm font-semibold text-white transition hover:bg-black/90 disabled:cursor-not-allowed disabled:bg-black/20 disabled:text-black/50 dark:bg-white dark:text-black dark:hover:bg-white/90 dark:disabled:bg-white/30 dark:disabled:text-black/60"
          >
            {t("home.generate")}
          </button>
        </label>
      </div>

      <div className="mt-5 text-xs text-black/60 dark:text-white/60">{t("home.hint")}</div>
    </motion.div>
  );
}
