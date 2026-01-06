"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import ResultView from "@/components/ResultView";
import type { GenerateResponse } from "@/lib/edge/types";

export default function ResultPageClient() {
  const sp = useSearchParams();
  const { t, i18n } = useTranslation();

  const prompt = useMemo(() => (sp.get("prompt") ?? "").trim(), [sp]);
  const lang = useMemo(() => (sp.get("lang") ?? "en").trim() || "en", [sp]);

  const [data, setData] = useState<GenerateResponse | null>(null);
  const [clientApiMs, setClientApiMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lang) return;
    if (i18n.language !== lang) void i18n.changeLanguage(lang);
  }, [i18n, lang]);

  useEffect(() => {
    if (!data?.lang) return;
    if (i18n.language !== data.lang) void i18n.changeLanguage(data.lang);
  }, [data?.lang, i18n]);

  useEffect(() => {
    setData(null);
    setClientApiMs(null);
    setError(null);

    if (!prompt) return;

    const url = new URL("/api/generate", globalThis.location.origin);
    url.searchParams.set("prompt", prompt);
    url.searchParams.set("lang", lang);

    const ac = new AbortController();
    const t0 = performance.now();

    fetch(url, { cache: "no-store", signal: ac.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return (await res.json()) as GenerateResponse;
      })
      .then((json) => {
        setClientApiMs(Math.round(performance.now() - t0));
        setData(json);
      })
      .catch((e) => {
        if (ac.signal.aborted) return;
        setError(e instanceof Error ? e.message : String(e));
      });

    return () => ac.abort();
  }, [prompt, lang]);

  if (!prompt) {
    return (
      <div className="rounded-3xl border border-black/10 bg-white/70 p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_20px_60px_rgba(0,0,0,0.12)] dark:border-white/10 dark:bg-white/5 dark:shadow-glow">
        <h2 className="text-lg font-semibold">{t("errors.missingPrompt.title")}</h2>
        <p className="mt-2 text-sm text-black/70 dark:text-white/70">{t("errors.missingPrompt.desc")}</p>
        <a className="mt-4 inline-flex rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90" href="/">
          {t("actions.backHome")}
        </a>
      </div>
    );
  }

  return (
    <>
      {error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-100">{error}</div>
      ) : null}
      {data ? <ResultView data={data} clientApiMs={clientApiMs ?? undefined} /> : null}
    </>
  );
}
