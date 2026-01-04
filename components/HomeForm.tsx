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

export default function HomeForm({ initialLang }: { initialLang: string }) {
  const router = useRouter();
  const { t, i18n } = useTranslation();

  const [prompt, setPrompt] = useState<string>("");
  const [lang, setLang] = useState<string>("auto");

  const effectiveLang = useMemo(() => (lang === "auto" ? initialLang : lang), [lang, initialLang]);

  useEffect(() => {
    void i18n.changeLanguage(effectiveLang);
  }, [effectiveLang, i18n]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow backdrop-blur"
    >
      <div className="space-y-2">
        <h2 className="text-lg font-semibold md:text-xl">{t("home.title")}</h2>
        <p className="text-sm text-white/70">{t("home.subtitle")}</p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-[1fr_180px]">
        <label className="space-y-2">
          <span className="text-xs text-white/60">{t("home.promptLabel")}</span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t("home.promptPlaceholder")}
            className="min-h-[112px] w-full resize-none rounded-2xl border border-white/10 bg-black/40 p-4 text-sm outline-none ring-0 placeholder:text-white/40 focus:border-white/25 focus:bg-black/55"
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs text-white/60">{t("home.langLabel")}</span>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="h-[46px] w-full rounded-2xl border border-white/10 bg-black/40 px-3 text-sm outline-none focus:border-white/25"
          >
            {LANGS.map((l) => (
              <option key={l.value} value={l.value}>
                {t(l.labelKey)}
              </option>
            ))}
          </select>

          <button
            onClick={() =>
              router.push(
                `/result?prompt=${encodeURIComponent(prompt)}&lang=${encodeURIComponent(effectiveLang)}`
              )
            }
            disabled={!prompt.trim()}
            className="mt-2 h-[46px] w-full rounded-2xl bg-white px-4 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-white/30 disabled:text-black/60"
          >
            {t("home.generate")}
          </button>
        </label>
      </div>

      <div className="mt-5 text-xs text-white/60">{t("home.hint")}</div>
    </motion.div>
  );
}
