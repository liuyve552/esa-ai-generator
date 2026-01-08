"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { GenerateResponse } from "@/lib/edge/types";
import ResultView from "@/components/ResultView";
import DebugPanel from "@/components/DebugPanel";

type Mode = "oracle" | "travel" | "focus" | "calm" | "card";
type Mood = "happy" | "calm" | "neutral" | "anxious" | "custom";
type WeatherOverride = "auto" | "clear" | "rain";

const MODES: { value: Mode; labelKey: string }[] = [
  { value: "oracle", labelKey: "mode.oracle" },
  { value: "travel", labelKey: "mode.travel" },
  { value: "focus", labelKey: "mode.focus" },
  { value: "calm", labelKey: "mode.calm" },
  { value: "card", labelKey: "mode.card" }
];

const MOODS: { value: Mood; labelKey: string }[] = [
  { value: "happy", labelKey: "mood.happy" },
  { value: "calm", labelKey: "mood.calm" },
  { value: "neutral", labelKey: "mood.neutral" },
  { value: "anxious", labelKey: "mood.anxious" },
  { value: "custom", labelKey: "mood.custom" }
];

const WEATHER: { value: WeatherOverride; labelKey: string }[] = [
  { value: "auto", labelKey: "weather.auto" },
  { value: "clear", labelKey: "weather.clear" },
  { value: "rain", labelKey: "weather.rain" }
];

function GlobeLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="28"
      height="28"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="32" cy="32" r="22" stroke="currentColor" strokeWidth="3" />
      <path
        d="M10 32h44"
        stroke="currentColor"
        strokeOpacity="0.65"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M32 10c6 7 10 14 10 22s-4 15-10 22c-6-7-10-14-10-22s4-15 10-22Z"
        stroke="currentColor"
        strokeOpacity="0.65"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M18 18c4 2 9 3 14 3s10-1 14-3"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M18 46c4-2 9-3 14-3s10 1 14 3"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GearIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M19.4 13.5a7.9 7.9 0 0 0 0-3l2-1.5-2-3.4-2.4 1a8.5 8.5 0 0 0-2.6-1.5l-.4-2.5H10l-.4 2.5A8.5 8.5 0 0 0 7 6.6l-2.4-1-2 3.4 2 1.5a7.9 7.9 0 0 0 0 3l-2 1.5 2 3.4 2.4-1a8.5 8.5 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a8.5 8.5 0 0 0 2.6-1.5l2.4 1 2-3.4-2-1.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function useEffectiveLang() {
  const { i18n } = useTranslation();
  return useMemo(() => {
    const v = (i18n.resolvedLanguage ?? i18n.language ?? "zh").toLowerCase();
    return v.split("-")[0] ?? "zh";
  }, [i18n.language, i18n.resolvedLanguage]);
}

type Coords = { latitude: number; longitude: number };

// NDJSON stream frames emitted by /api/generate?stream=1 (edge/index.js).
// - meta: lets the UI render the result card before any token arrives.
// - token: incremental delta, appended to content.text for a ChatGPT-like typing effect.
// - done: the final full GenerateResponse, also persisted into KV + memory cache.
type GenerateStreamFrame =
  | { type: "meta"; data: GenerateResponse }
  | { type: "token"; data: string }
  | { type: "done"; data: GenerateResponse }
  | { type: "error"; error: string };

function hexToRgbTriplet(hex: string): string | null {
  const raw = String(hex || "").trim().replace(/^#/, "");
  if (raw.length !== 6) return null;
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  if (![r, g, b].every((n) => Number.isFinite(n))) return null;
  return `${r} ${g} ${b}`;
}

async function getGeolocationIfGranted(): Promise<Coords | null> {
  try {
    if (typeof navigator === "undefined") return null;
    if (!("geolocation" in navigator)) return null;

    const perms = (navigator as any).permissions;
    if (perms?.query) {
      const st = await perms.query({ name: "geolocation" });
      if (st?.state !== "granted") return null;
    }

    return await new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 1200, maximumAge: 10 * 60 * 1000 }
      );
    });
  } catch {
    return null;
  }
}

export default function OraclePage() {
  const { t, i18n } = useTranslation();
  const effectiveLang = useEffectiveLang();

  const [mode, setMode] = useState<Mode>("oracle");
  const [mood, setMood] = useState<Mood>("neutral");
  const [moodText, setMoodText] = useState<string>("");
  const [weatherOverride, setWeatherOverride] = useState<WeatherOverride>("auto");
  const [prompt, setPrompt] = useState<string>("");
  const [debugOpen, setDebugOpen] = useState<boolean>(false);

  const [coords, setCoords] = useState<Coords | null>(null);

  const [data, setData] = useState<GenerateResponse | null>(null);
  const [clientApiMs, setClientApiMs] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState<boolean>(false);

  const lastReq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!effectiveLang) return;
    if (i18n.language !== effectiveLang) void i18n.changeLanguage(effectiveLang);
  }, [effectiveLang, i18n]);

  useEffect(() => {
    void getGeolocationIfGranted().then((c) => setCoords(c));
  }, []);

  useEffect(() => {
    if (!data?.visual?.palette) return;
    const p = data.visual.palette;
    const root = document.documentElement;
    root.style.setProperty("--esa-bg", p.bg);
    root.style.setProperty("--esa-fg", p.fg);
    const rgb = hexToRgbTriplet(p.accent);
    if (rgb) root.style.setProperty("--esa-accent-rgb", rgb);
  }, [data?.visual?.palette]);

  const readNdjsonStream = async (
    res: Response,
    opts: {
      reqId: number;
      onMeta: (data: GenerateResponse) => void;
      onToken: (delta: string) => void;
      onDone: (data: GenerateResponse) => void;
      onError: (message: string) => void;
    }
  ) => {
    if (!res.body) throw new Error("Stream body is empty");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    const handle = (rawLine: string) => {
      const line = rawLine.trim();
      if (!line) return;

      let frame: GenerateStreamFrame | null = null;
      try {
        frame = JSON.parse(line) as GenerateStreamFrame;
      } catch {
        return;
      }

      if (opts.reqId !== lastReq.current) return;

      if (frame?.type === "meta" && frame.data) return opts.onMeta(frame.data);
      if (frame?.type === "token" && typeof frame.data === "string") return opts.onToken(frame.data);
      if (frame?.type === "done" && frame.data) return opts.onDone(frame.data);
      if (frame?.type === "error") return opts.onError(String((frame as any).error ?? "Unknown stream error"));
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buf += decoder.decode(value, { stream: true });
      const lines = buf.split(/\r?\n/);
      buf = lines.pop() ?? "";
      for (const line of lines) handle(line);
    }

    if (buf) handle(buf);
  };

  const generate = async (opts?: { auto?: boolean }) => {
    const reqId = ++lastReq.current;
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setStreaming(false);
    setError(null);
    setClientApiMs(null);
    setData(null);

    const moodTextValue = mood === "custom" ? moodText.trim() : "";
    const moodValue = mood === "custom" && !moodTextValue ? "neutral" : mood;

    const started = performance.now();
    try {
      const url = new URL("/api/generate", globalThis.location.origin);
      url.searchParams.set("lang", effectiveLang);
      url.searchParams.set("mode", mode);
      url.searchParams.set("mood", moodValue);
      if (moodValue === "custom" && moodTextValue) url.searchParams.set("moodText", moodTextValue);
      url.searchParams.set("weather", weatherOverride);
      url.searchParams.set("prompt", prompt.trim());
      url.searchParams.set("stream", "1");
      if (opts?.auto) url.searchParams.set("auto", "1");

      const res = await fetch(url, {
        method: coords ? "POST" : "GET",
        cache: "no-store",
        signal: abortRef.current.signal,
        headers: coords ? { "Content-Type": "application/json" } : undefined,
        body: coords
          ? JSON.stringify({
              prompt: prompt.trim(),
              lang: effectiveLang,
              mode,
              mood: moodValue,
              moodText: moodValue === "custom" ? moodTextValue : "",
              weather: weatherOverride,
              coords
            })
          : undefined
      });

      if (reqId !== lastReq.current) return;

      if (!res.ok) throw new Error(await res.text());

      const ct = (res.headers.get("content-type") ?? "").toLowerCase();
      if (ct.includes("application/x-ndjson")) {
        setStreaming(true);

        await readNdjsonStream(res, {
          reqId,
          onMeta: (next) => setData(next),
          onToken: (delta) =>
            setData((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                content: { ...prev.content, text: (prev.content.text ?? "") + delta }
              };
            }),
          onDone: (final) => {
            setClientApiMs(Math.round(performance.now() - started));
            setData(final);
            setStreaming(false);
            setLoading(false);
          },
          onError: (message) => {
            setError(message);
            setStreaming(false);
            setLoading(false);
          }
        });

        // If the stream ends without a final frame, keep loading state consistent.
        if (reqId === lastReq.current) {
          setClientApiMs(Math.round(performance.now() - started));
          setStreaming(false);
        }
        return;
      }

      // Fallback: non-streaming JSON (still supported by the edge handler).
      const json = (await res.json()) as GenerateResponse;
      setClientApiMs(Math.round(performance.now() - started));
      setData(json);
    } catch (e) {
      if (reqId !== lastReq.current) return;
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (reqId === lastReq.current) setLoading(false);
    }
  };

  useEffect(() => {
    void generate({ auto: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveLang]);

  return (
    <div className="mx-auto w-full max-w-5xl px-5 pb-16 pt-8 md:px-6 md:pt-10">
      <nav className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="text-[#F97316]">
            <GlobeLogo className="h-7 w-7" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-black/90 dark:text-white/90">全球边缘神谕</div>
            <div className="text-xs text-black/55 dark:text-white/55">打开即用 · 边缘就近 · 可分享海报</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="hidden md:block">
            <span className="sr-only">{t("home.modeLabel")}</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
              className="h-9 rounded-xl border border-black/10 bg-white/60 px-3 text-xs text-black/80 backdrop-blur focus:border-black/20 dark:border-white/15 dark:bg-black/30 dark:text-white/85"
            >
              {MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {t(m.labelKey)}
                </option>
              ))}
            </select>
          </label>

          <button
            className="inline-flex h-9 items-center justify-center rounded-xl border border-black/10 bg-white/60 px-3 text-xs text-black/80 backdrop-blur transition hover:bg-white/80 dark:border-white/15 dark:bg-black/30 dark:text-white/85 dark:hover:bg-black/40"
            onClick={() => setDebugOpen((v) => !v)}
            aria-label={debugOpen ? "隐藏技术细节" : "显示技术细节"}
          >
            <GearIcon className="h-5 w-5" />
          </button>
        </div>
      </nav>

      <section className="mt-7 rounded-3xl border border-black/10 bg-white/55 p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_18px_60px_rgba(0,0,0,0.10)] backdrop-blur dark:border-white/10 dark:bg-black/25 dark:shadow-glow">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-black/90 dark:text-white/90">{t("home.title")}</h2>
          <p className="text-sm text-black/70 dark:text-white/70">{t("home.subtitle")}</p>
          <p className="text-sm text-gray-400">{"\u9009\u62e9\u6a21\u5f0f\u5e76\u6dfb\u52a0\u5fc3\u60c5\uff0c\u751f\u6210\u4e13\u5c5e\u795e\u8c15"}</p>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_200px]">
          <label className="space-y-2">
            <span className="text-xs text-black/60 dark:text-white/60">{t("home.promptLabel")}</span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t("home.promptPlaceholder")}
              className="min-h-[96px] w-full resize-none rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-black/90 outline-none placeholder:text-black/40 focus:border-black/20 dark:border-white/10 dark:bg-black/30 dark:text-white/90 dark:placeholder:text-white/35 dark:focus:border-white/25"
            />
          </label>

          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
              <label className="space-y-2">
                <span className="text-xs text-black/60 dark:text-white/60">{t("home.modeLabel")}</span>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as Mode)}
                  className="h-10 w-full rounded-2xl border border-black/10 bg-white/60 px-3 text-sm text-black/85 outline-none focus:border-black/20 dark:border-white/10 dark:bg-black/30 dark:text-white/90 dark:focus:border-white/25"
                >
                  {MODES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {t(m.labelKey)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs text-black/60 dark:text-white/60">{t("home.moodLabel")}</span>
                <div className="space-y-2">
                  <select
                    value={mood}
                    onChange={(e) => setMood(e.target.value as Mood)}
                    className="h-10 w-full rounded-2xl border border-black/10 bg-white/60 px-3 text-sm text-black/85 outline-none focus:border-black/20 dark:border-white/10 dark:bg-black/30 dark:text-white/90 dark:focus:border-white/25"
                  >
                    {MOODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {t(m.labelKey)}
                      </option>
                    ))}
                  </select>

                  {mood === "custom" ? (
                    <input
                      value={moodText}
                      onChange={(e) => setMoodText(e.target.value)}
                      placeholder={"\u81ea\u5b9a\u4e49\u5fc3\u60c5\uff08\u5982\uff1a\u75b2\u60eb/\u5174\u594b/\u8ff7\u832b...\uff09"}
                      className="h-10 w-full rounded-2xl border border-black/10 bg-white/70 px-3 text-sm text-black/85 outline-none placeholder:text-black/40 focus:border-black/20 dark:border-white/10 dark:bg-black/30 dark:text-white/90 dark:placeholder:text-white/35 dark:focus:border-white/25"
                      maxLength={24}
                    />
                  ) : null}
                </div>
              </label>
            </div>

            <label className="space-y-2">
              <span className="text-xs text-black/60 dark:text-white/60">{t("home.weatherLabel")}</span>
              <select
                value={weatherOverride}
                onChange={(e) => setWeatherOverride(e.target.value as WeatherOverride)}
                className="h-10 w-full rounded-2xl border border-black/10 bg-white/60 px-3 text-sm text-black/85 outline-none focus:border-black/20 dark:border-white/10 dark:bg-black/30 dark:text-white/90 dark:focus:border-white/25"
              >
                {WEATHER.map((w) => (
                  <option key={w.value} value={w.value}>
                    {t(w.labelKey)}
                  </option>
                ))}
              </select>
            </label>

            <button
              onClick={() => void generate()}
              disabled={loading}
              className="h-10 w-full rounded-2xl bg-[#F97316] px-4 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(249,115,22,0.25)] transition duration-100 hover:scale-[1.01] hover:bg-[#fb8531] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? t("home.loading") : t("home.generate")}
            </button>
          </div>
        </div>
      </section>

      <section className="mt-6">
        {error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div>
        ) : null}

        {data ? (
          <ResultView data={data} clientApiMs={clientApiMs ?? undefined} streaming={streaming} />
        ) : (
          <div className="rounded-3xl border border-black/10 bg-white/45 p-6 backdrop-blur dark:border-white/10 dark:bg-black/20">
            <div className="h-5 w-44 animate-pulse rounded bg-black/10 dark:bg-white/10" />
            <div className="mt-4 space-y-2">
              <div className="h-4 w-full animate-pulse rounded bg-black/10 dark:bg-white/10" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-black/10 dark:bg-white/10" />
              <div className="h-4 w-4/6 animate-pulse rounded bg-black/10 dark:bg-white/10" />
            </div>
          </div>
        )}
      </section>

      {debugOpen && data ? (
        <DebugPanel data={data} clientApiMs={clientApiMs ?? undefined} onClose={() => setDebugOpen(false)} />
      ) : null}
    </div>
  );
}
