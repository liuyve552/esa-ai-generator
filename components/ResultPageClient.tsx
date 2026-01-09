"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import ResultView from "@/components/ResultView";
import type { GenerateResponse } from "@/lib/edge/types";

export default function ResultPageClient() {
  const sp = useSearchParams();
  const { t, i18n } = useTranslation();

  const id = useMemo(() => (sp.get("id") ?? "").trim(), [sp]);
  const d = useMemo(() => (sp.get("d") ?? "").trim(), [sp]);
  const prompt = useMemo(() => (sp.get("prompt") ?? "").trim(), [sp]);
  const lang = useMemo(() => (sp.get("lang") ?? "zh").trim() || "zh", [sp]);
  const mode = useMemo(() => (sp.get("mode") ?? "oracle").trim() || "oracle", [sp]);
  const mood = useMemo(() => (sp.get("mood") ?? "").trim(), [sp]);
  const moodText = useMemo(() => (sp.get("moodText") ?? "").trim(), [sp]);
  const weather = useMemo(() => (sp.get("weather") ?? "").trim(), [sp]);

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

    const ac = new AbortController();
    const t0 = performance.now();

    const incView = (shareId: string) =>
      fetch(`/api/view/${encodeURIComponent(shareId)}`, { method: "POST", cache: "no-store", signal: ac.signal }).catch(
        () => null
      );

    const load = async () => {
      // Share/replay first: /result can act as a share landing (EdgeKV-backed).
      if (id || d) {
        if (id) {
          void incView(id);

          const qs = new URLSearchParams();
          qs.set("id", id);
          if (d) qs.set("d", d);

          const res = await fetch(`/api/share?${qs.toString()}`, { cache: "no-store", signal: ac.signal });
          if (res.ok) {
            const json = (await res.json()) as GenerateResponse;
            setClientApiMs(Math.round(performance.now() - t0));
            setData(json);
            return;
          }

          if (res.status !== 404 || !d) throw new Error(await res.text());
        }

        if (!d) throw new Error(t("errors.missingSharePayload"));
        const res = await fetch(`/api/replay?d=${encodeURIComponent(d)}`, { cache: "no-store", signal: ac.signal });
        if (!res.ok) throw new Error(await res.text());
        const json = (await res.json()) as GenerateResponse;
        if (json.share?.id) void incView(json.share.id);

        setClientApiMs(Math.round(performance.now() - t0));
        setData(json);
        return;
      }

      // Otherwise: regenerate by query params (still cacheable on Edge).
      const url = new URL("/api/generate", globalThis.location.origin);
      url.searchParams.set("prompt", prompt);
      url.searchParams.set("lang", lang);
      url.searchParams.set("mode", mode);
      if (mood) url.searchParams.set("mood", mood);
      if (moodText) url.searchParams.set("moodText", moodText);
      if (weather) url.searchParams.set("weather", weather);

      const res = await fetch(url, { cache: "no-store", signal: ac.signal });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as GenerateResponse;
      setClientApiMs(Math.round(performance.now() - t0));
      setData(json);
    };

    void load()
      .catch((e) => {
        if (ac.signal.aborted) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => setLoading(false));

    return () => ac.abort();
  }, [d, id, lang, mode, mood, moodText, prompt, t, weather]);

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
      {data ? <ResultView data={data} sharedId={id || undefined} clientApiMs={clientApiMs ?? undefined} /> : null}
    </>
  );
}
