"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { GenerateResponse } from "@/lib/edge/types";

function useEffectiveLang() {
  const { i18n } = useTranslation();
  return useMemo(() => {
    const v = (i18n.resolvedLanguage ?? i18n.language ?? "zh").toLowerCase();
    return v.split("-")[0] ?? "zh";
  }, [i18n.language, i18n.resolvedLanguage]);
}

function placeOf(data: GenerateResponse) {
  return (
    [data.location.city, data.location.country].filter((v): v is string => typeof v === "string" && v.length > 0).join(", ") ||
    "Unknown"
  );
}

export default function HomeAutoDemo() {
  const { t } = useTranslation();
  const lang = useEffectiveLang();

  const [data, setData] = useState<GenerateResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const url = new URL("/api/generate", globalThis.location.origin);
    url.searchParams.set("prompt", "");
    url.searchParams.set("lang", lang);
    url.searchParams.set("mode", "oracle");

    const ac = new AbortController();
    fetch(url, { cache: "no-store", signal: ac.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return (await res.json()) as GenerateResponse;
      })
      .then((json) => setData(json))
      .catch((e) => {
        if (ac.signal.aborted) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => setLoading(false));

    return () => ac.abort();
  }, [lang]);

  return (
    <section className="mt-6 rounded-3xl border border-black/10 bg-white/60 p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_16px_50px_rgba(0,0,0,0.10)] backdrop-blur dark:border-white/10 dark:bg-white/5 dark:shadow-glow">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <div className="text-xs tracking-widest text-black/60 dark:text-white/60">{t("home.demoTitle")}</div>
          <h3 className="text-base font-semibold md:text-lg">{t("home.demoDesc")}</h3>
        </div>
        <a
          className="inline-flex h-9 items-center justify-center rounded-xl bg-black px-3 text-xs font-semibold text-white transition hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
          href={`/result/?prompt=&lang=${encodeURIComponent(lang)}&mode=oracle`}
        >
          {t("home.openFull")}
        </a>
      </div>

      {loading ? (
        <div className="mt-5 grid gap-3 md:grid-cols-[120px_1fr]">
          <div className="h-[120px] rounded-2xl bg-black/10 dark:bg-white/10" />
          <div className="space-y-2">
            <div className="h-4 w-56 rounded bg-black/10 dark:bg-white/10" />
            <div className="h-4 w-full rounded bg-black/10 dark:bg-white/10" />
            <div className="h-4 w-5/6 rounded bg-black/10 dark:bg-white/10" />
            <div className="h-4 w-4/6 rounded bg-black/10 dark:bg-white/10" />
          </div>
        </div>
      ) : error ? (
        <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div>
      ) : data ? (
        <div className="mt-5 grid gap-4 md:grid-cols-[140px_1fr]">
          <div className="overflow-hidden rounded-2xl border border-black/10 bg-white p-2 dark:border-white/10 dark:bg-black/30">
            {data.visual?.svg ? (
              <div className="h-[120px] w-full" dangerouslySetInnerHTML={{ __html: data.visual.svg }} />
            ) : (
              <div className="h-[120px] w-full rounded-xl bg-black/10 dark:bg-white/10" />
            )}
          </div>

          <div className="space-y-2">
            <div className="text-sm font-semibold text-black/90 dark:text-white/90">
              {data.daily?.title ?? t("mode.oracle")} · {placeOf(data)} ·{" "}
              {typeof data.weather.temperatureC === "number" ? `${Math.round(data.weather.temperatureC)}°C` : t("common.na")} ·{" "}
              {data.weather.description || t("common.unknown")}
            </div>
            {data.daily?.shareLine ? (
              <div className="text-sm text-black/80 dark:text-white/80">{data.daily.shareLine}</div>
            ) : null}
            <div className="max-h-[92px] overflow-hidden whitespace-pre-wrap text-xs leading-relaxed text-black/70 dark:text-white/70">
              {data.content.text}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
