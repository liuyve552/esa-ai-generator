"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { GenerateResponse } from "@/lib/edge/types";

const WorldMap = dynamic(() => import("@/components/WorldMap"), { ssr: false });

type WeatherKind = "clear" | "rain" | "cloud";

function pickWeatherKind(weatherCode: number | null | undefined): WeatherKind {
  if (weatherCode == null) return "cloud";
  if (weatherCode === 0) return "clear";
  if (
    weatherCode === 51 ||
    weatherCode === 53 ||
    weatherCode === 55 ||
    weatherCode === 56 ||
    weatherCode === 57 ||
    weatherCode === 61 ||
    weatherCode === 63 ||
    weatherCode === 65 ||
    weatherCode === 66 ||
    weatherCode === 67 ||
    weatherCode === 80 ||
    weatherCode === 81 ||
    weatherCode === 82 ||
    weatherCode === 95 ||
    weatherCode === 96 ||
    weatherCode === 99
  )
    return "rain";
  return "cloud";
}

function WeatherGlyph({ kind }: { kind: WeatherKind }) {
  const className = kind === "clear" ? "text-[#F97316]" : kind === "rain" ? "text-sky-300" : "text-white/70";

  return (
    <motion.div
      aria-hidden
      className={`inline-flex h-9 w-9 items-center justify-center ${className}`}
      animate={{ scale: [1, 1.04, 1], opacity: [1, 0.86, 1] }}
      transition={{ duration: 0.55, repeat: Infinity, ease: "easeInOut" }}
    >
      {kind === "clear" ? (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="2" />
          <path
            d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M19.8 4.2l-1.6 1.6M5.8 18.2l-1.6 1.6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      ) : kind === "rain" ? (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <path
            d="M7 16.5h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M9 18.5l-1 2M13 18.5l-1 2M17 18.5l-1 2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <path
            d="M7 16.5h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      )}
    </motion.div>
  );
}

function useStreamedText(text: string, enabled: boolean) {
  const [visible, setVisible] = useState(enabled ? "" : text);
  const [done, setDone] = useState(!enabled);

  useEffect(() => {
    if (!enabled) {
      setVisible(text);
      setDone(true);
      return;
    }

    let i = 0;
    setVisible("");
    setDone(false);

    const tickMs = 28;
    const charsPerTick = Math.max(2, Math.round((240 * tickMs) / 1000));
    const timer = setInterval(() => {
      i = Math.min(text.length, i + charsPerTick);
      setVisible(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(timer);
        setDone(true);
      }
    }, tickMs);

    return () => clearInterval(timer);
  }, [text, enabled]);

  return { visible, done };
}

function toReadablePlace(location: GenerateResponse["location"], fallback: string) {
  return [location.city, location.country].filter((v): v is string => typeof v === "string" && v.length > 0).join(", ") || fallback;
}

export default function ResultView(props: {
  data: GenerateResponse;
  sharedId?: string;
  clientApiMs?: number;
  streaming?: boolean;
}) {
  const { data, sharedId, streaming } = props;
  const { t } = useTranslation();

  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [saved, setSaved] = useState(false);
  const [taskState, setTaskState] = useState<Record<string, boolean>>({});

  const streamingEnabled = streaming === true;
  const { visible: streamedText, done: streamDone } = useStreamedText(data.content.text || "", streamingEnabled);

  const formatTemp = (value: number | null | undefined) => {
    if (typeof value !== "number" || Number.isNaN(value)) return t("common.na");
    return `${Math.round(value)}°C`;
  };

  const place = useMemo(() => toReadablePlace(data.location, t("common.unknown")), [data.location, t]);
  const scenarioKey = (data.mode ?? "oracle").toString();
  const scenarioLabel = t(`mode.${scenarioKey}`, { defaultValue: scenarioKey });

  const weatherKind = pickWeatherKind(data.weather.weatherCode);

  const shareUrl = useMemo(() => {
    const origin = globalThis.location?.origin ?? "";
    const fromApi = data.share?.url;
    if (fromApi) return `${origin}${fromApi}`;
    const id = sharedId ?? data.share?.id;
    if (!id) return null;
    return `${origin}/s/?id=${id}`;
  }, [data.share?.id, data.share?.url, sharedId]);

  const dailyKey = useMemo(() => {
    const date = data.daily?.date || data.generatedAt.slice(0, 10);
    const city = data.location.city || "unknown";
    return `esa:daily:${date}:${scenarioKey}:${city}`;
  }, [data.daily?.date, data.generatedAt, data.location.city, scenarioKey]);

  useEffect(() => {
    try {
      if (!data.daily?.tasks?.length) return;
      const raw = globalThis.localStorage?.getItem(dailyKey);
      if (!raw) return setTaskState({});
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      setTaskState(parsed && typeof parsed === "object" ? parsed : {});
    } catch {
      setTaskState({});
    }
  }, [dailyKey, data.daily?.tasks?.length]);

  useEffect(() => {
    try {
      const id = data.share?.id ?? data.generatedAt;
      const k = `esa:saved:${id}`;
      setSaved(globalThis.localStorage?.getItem(k) === "1");
    } catch {
      setSaved(false);
    }
  }, [data.generatedAt, data.share?.id]);

  useEffect(() => {
    return () => {
      try {
        globalThis.speechSynthesis?.cancel();
      } catch {
        // ignore
      }
    };
  }, []);

  const tasks = data.daily?.tasks ?? [];
  const doneCount = tasks.reduce((acc, task) => acc + (taskState[task] ? 1 : 0), 0);

  const canSystemShare = typeof navigator !== "undefined" && typeof (navigator as any).share === "function";

  const toggleTask = (task: string) => {
    const next = { ...taskState, [task]: !taskState[task] };
    setTaskState(next);
    try {
      globalThis.localStorage?.setItem(dailyKey, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const resetTasks = () => {
    setTaskState({});
    try {
      globalThis.localStorage?.removeItem(dailyKey);
    } catch {
      // ignore
    }
  };

  const toggleSave = () => {
    try {
      const id = data.share?.id ?? data.generatedAt;
      const k = `esa:saved:${id}`;
      const next = !saved;
      if (next) globalThis.localStorage?.setItem(k, "1");
      else globalThis.localStorage?.removeItem(k);
      setSaved(next);
    } catch {
      setSaved((v) => !v);
    }
  };

  const speak = () => {
    try {
      if (typeof SpeechSynthesisUtterance === "undefined") return;
      globalThis.speechSynthesis?.cancel();
      const text = data.content.text || data.daily?.shareLine || "";
      if (!text) return;

      const ut = new SpeechSynthesisUtterance(text);
      ut.lang = data.lang || "zh-CN";
      ut.onend = () => setSpeaking(false);
      ut.onerror = () => setSpeaking(false);
      setSpeaking(true);
      globalThis.speechSynthesis?.speak(ut);
    } catch {
      setSpeaking(false);
    }
  };

  const stopSpeak = () => {
    try {
      globalThis.speechSynthesis?.cancel();
    } catch {
      // ignore
    }
    setSpeaking(false);
  };

  const systemShare = async () => {
    if (!shareUrl || !canSystemShare) return;
    try {
      await (navigator as any).share({
        title: "全球边缘神谕",
        text: data.daily?.shareLine || "",
        url: shareUrl
      });
    } catch {
      // ignore
    }
  };

  const downloadPoster = async () => {
    if (!shareUrl) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1350;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const bg0 = "#2E1065";
      const bg1 = "#0b0b12";
      const accent = "#F97316";
      const fg = "#f4f4f5";

      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, bg0);
      grad.addColorStop(0.55, bg1);
      grad.addColorStop(1, accent);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "rgba(0,0,0,0.20)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const drawWrapped = (
        text: string,
        x: number,
        y: number,
        maxWidth: number,
        lineHeight: number,
        maxLines: number
      ) => {
        const s = text.replace(/\r/g, "");
        let line = "";
        let lines = 0;

        const flush = () => {
          ctx.fillText(line, x, y);
          y += lineHeight;
          lines++;
          line = "";
        };

        for (const ch of s) {
          if (ch === "\n") {
            flush();
            if (lines >= maxLines) return;
            continue;
          }

          const test = line + ch;
          if (ctx.measureText(test).width <= maxWidth) {
            line = test;
            continue;
          }

          flush();
          if (lines >= maxLines) return;
          line = ch;
        }

        if (line && lines < maxLines) ctx.fillText(line, x, y);
      };

      if (data.visual?.svg) {
        const blob = new Blob([data.visual.svg], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 760, 96, 240, 240);
            URL.revokeObjectURL(url);
            resolve();
          };
          img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve();
          };
          img.src = url;
        });
      }

      ctx.fillStyle = fg;
      ctx.font = "bold 64px system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.fillText("全球边缘神谕", 72, 158);

      ctx.font = "bold 44px system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.fillText(`${scenarioLabel} · ${place}`, 72, 242);

      ctx.font = "28px system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.fillText(`${formatTemp(data.weather.temperatureC)} · ${data.weather.description || t("common.unknown")}`, 72, 304);

      ctx.globalAlpha = 0.96;
      ctx.font = "32px system-ui, -apple-system, Segoe UI, sans-serif";
      drawWrapped(data.daily?.shareLine || data.content.text.slice(0, 120), 72, 392, 936, 48, 4);
      ctx.globalAlpha = 1;

      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "rgba(249,115,22,0.92)";
      ctx.fillRect(72, 1168, 936, 2);
      ctx.globalAlpha = 1;

      ctx.fillStyle = fg;
      ctx.globalAlpha = 0.85;
      ctx.font = "24px system-ui, -apple-system, Segoe UI, sans-serif";
      drawWrapped(shareUrl, 72, 1238, 936, 34, 3);
      ctx.globalAlpha = 1;

      const a = document.createElement("a");
      a.download = `edge-oracle-${Date.now()}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    } catch {
      // ignore
    }
  };

  const actionsButtonBase =
    "inline-flex h-9 items-center justify-center rounded-xl border border-white/12 bg-white/5 px-3 text-xs text-white/85 transition hover:bg-white/10 active:scale-[0.99]";
  const actionsPrimary =
    "inline-flex h-9 items-center justify-center rounded-xl bg-[#F97316] px-3 text-xs font-semibold text-white shadow-[0_10px_30px_rgba(249,115,22,0.25)] transition hover:bg-[#fb8531] active:scale-[0.99]";

  const statsLine = useMemo(() => {
    const parts: string[] = [];
    if (data.stats) {
      parts.push(t("stats.global", { count: data.stats.todayGlobal }));
      parts.push(t("stats.city", { city: data.location.city ?? t("common.unknown"), count: data.stats.todayCity }));
    }
    if (data.share?.views != null) parts.push(t("result.views", { count: data.share.views }));
    return parts.join(" · ");
  }, [data.location.city, data.share?.views, data.stats, t]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#1f2937]/70 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(249,115,22,0.14),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgba(46,16,101,0.55),transparent_55%)]" />
      <div className="relative">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <WeatherGlyph kind={weatherKind} />
              <div className="leading-tight">
                <div className="text-xs tracking-widest text-white/55">{scenarioLabel}</div>
                <h2 className="text-2xl font-semibold text-white">{place}</h2>
                <div className="mt-1 text-sm text-white/70">
                  {formatTemp(data.weather.temperatureC)} · {data.weather.description || t("common.unknown")}
                </div>
              </div>
            </div>

            {data.daily?.shareLine ? <p className="text-base text-white/85">{data.daily.shareLine}</p> : null}
          </div>

          {data.visual?.svg ? (
            <div className="hidden h-[84px] w-[84px] overflow-hidden rounded-2xl border border-white/12 bg-black/20 p-1 md:block">
              <div className="h-full w-full" dangerouslySetInnerHTML={{ __html: data.visual.svg }} />
            </div>
          ) : null}
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-4">
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-white/90">
            {streamedText}
            {streamingEnabled && !streamDone ? (
              <motion.span
                aria-hidden
                className="ml-1 inline-block h-[1.05em] w-[2px] translate-y-[2px] bg-[#F97316]/90"
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
              />
            ) : null}
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-[3fr_1fr] md:items-start">
          <div className="space-y-4">
            {tasks.length ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-white/85">{t("daily.title")}</div>
                  <button
                    className="text-xs text-white/55 underline underline-offset-4 hover:text-white/70"
                    onClick={resetTasks}
                  >
                    {t("daily.reset")}
                  </button>
                </div>
                <div className="mt-1 text-xs text-white/55">{t("daily.progress", { done: doneCount, total: tasks.length })}</div>
                <div className="mt-3 space-y-2">
                  {tasks.map((task) => {
                    const checked = !!taskState[task];
                    return (
                      <label key={task} className="flex cursor-pointer items-start gap-2 text-sm text-white/85">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTask(task)}
                          className="mt-1 h-4 w-4 accent-[#F97316]"
                        />
                        <span className={checked ? "line-through opacity-70" : ""}>{task}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              {shareUrl ? (
                <button
                  className={actionsButtonBase}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(shareUrl);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1200);
                    } catch {
                      // ignore
                    }
                  }}
                >
                  {copied ? t("result.copied") : t("result.copyShare")}
                </button>
              ) : null}

              {shareUrl && canSystemShare ? (
                <button className={actionsButtonBase} onClick={() => void systemShare()}>
                  {t("actions.shareSystem")}
                </button>
              ) : null}

              {shareUrl ? (
                <button className={actionsPrimary} onClick={() => void downloadPoster()}>
                  {t("actions.downloadPoster")}
                </button>
              ) : null}

              {speaking ? (
                <button className={actionsButtonBase} onClick={stopSpeak}>
                  {t("actions.stopSpeak")}
                </button>
              ) : (
                <button className={actionsButtonBase} onClick={speak}>
                  {t("actions.speak")}
                </button>
              )}

              <button className={actionsButtonBase} onClick={toggleSave}>
                {saved ? t("actions.saved") : t("actions.save")}
              </button>
            </div>

            {statsLine ? <div className="text-xs text-white/45">{statsLine}</div> : null}
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="overflow-hidden rounded-2xl border border-white/10 bg-black/20"
          >
            <div className="h-[220px] w-full">
              <WorldMap latitude={data.location.latitude ?? 0} longitude={data.location.longitude ?? 0} city={data.location.city ?? undefined} />
            </div>
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
}