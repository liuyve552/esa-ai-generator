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
  const lang = useMemo(() => (sp.get("lang") ?? "zh").trim() || "zh", [sp]);
  const mode = useMemo(() => (sp.get("mode") ?? "oracle").trim() || "oracle", [sp]);

  const [data, setData] = useState<GenerateResponse | null>(null);
  const [clientApiMs, setClientApiMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

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
    setLoading(true);

    const url = new URL("/api/generate", globalThis.location.origin);
    url.searchParams.set("prompt", prompt);
    url.searchParams.set("lang", lang);
    url.searchParams.set("mode", mode);

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
      })
      .finally(() => setLoading(false));

    return () => ac.abort();
  }, [prompt, lang, mode]);

  if (loading && !data && !error) {
    return (
      <div className="rounded-3xl border border-black/10 bg-white/70 p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_20px_60px_rgba(0,0,0,0.12)] dark:border-white/10 dark:bg-white/5 dark:shadow-glow">
        <div className="h-5 w-44 animate-pulse rounded bg-black/10 dark:bg-white/10" />
        <div className="mt-4 space-y-2">
          <div className="h-4 w-full animate-pulse rounded bg-black/10 dark:bg-white/10" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-black/10 dark:bg-white/10" />
          <div className="h-4 w-4/6 animate-pulse rounded bg-black/10 dark:bg-white/10" />
        </div>
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
