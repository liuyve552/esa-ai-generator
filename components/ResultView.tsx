"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { GenerateResponse } from "@/lib/edge/types";
import LatencyChart from "@/components/LatencyChart";

const WorldMap = dynamic(() => import("@/components/WorldMap"), { ssr: false });

export default function ResultView({
  data,
  sharedId,
  clientApiMs
}: {
  data: GenerateResponse;
  sharedId?: string;
  clientApiMs?: number;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [saved, setSaved] = useState(false);
  const [taskState, setTaskState] = useState<Record<string, boolean>>({});

  const formatTemp = (value: number | null | undefined) => {
    if (typeof value !== "number" || Number.isNaN(value)) return t("common.na");
    return `${Math.round(value)}°C`;
  };

  const place =
    [data.location.city, data.location.country].filter((v): v is string => typeof v === "string" && v.length > 0).join(", ") ||
    t("common.unknown");

  const geoSourceLabel = t(`geoSource.${data.location.source}`, { defaultValue: data.location.source });
  const cacheLabel = data.cache.hit ? t("result.cache.hit") : t("result.cache.miss");
  const ttlMinutes = Math.round(data.cache.ttlMs / 60000);
  const aiModeLabel = t(`result.mode.${data.content.mode}`, { defaultValue: data.content.mode });
  const scenarioKey = (data.mode ?? "oracle").toString();
  const scenarioLabel = t(`mode.${scenarioKey}`, { defaultValue: scenarioKey });

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

  const networkOverheadMs =
    typeof clientApiMs === "number" ? Math.max(0, Math.round(clientApiMs - data.timing.totalMs)) : null;

  const edgeEndToEndMs = typeof clientApiMs === "number" ? clientApiMs : data.timing.totalMs;

  const metricsParts = [
    t("result.metrics", {
      total: data.timing.totalMs,
      geo: data.timing.geoMs,
      weather: data.timing.weatherMs,
      ai: data.timing.aiMs
    })
  ];

  if (typeof clientApiMs === "number") metricsParts.push(t("result.apiRoundTrip", { ms: clientApiMs }));
  if (networkOverheadMs != null) metricsParts.push(t("result.netOverhead", { ms: networkOverheadMs }));

  const metricsLine = metricsParts.join(" · ");

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

  const saveToHistory = () => {
    try {
      const id = data.share?.id ?? data.generatedAt;
      const savedKey = `esa:saved:${id}`;
      globalThis.localStorage?.setItem(savedKey, "1");

      const raw = globalThis.localStorage?.getItem("esa:history");
      const arr = raw ? (JSON.parse(raw) as any[]) : [];
      const item = {
        id,
        url: shareUrl,
        mode: scenarioKey,
        title: data.daily?.title ?? scenarioLabel,
        place,
        generatedAt: data.generatedAt
      };
      const next = [item, ...arr.filter((x) => x?.id !== id)].slice(0, 20);
      globalThis.localStorage?.setItem("esa:history", JSON.stringify(next));
      setSaved(true);
    } catch {
      // ignore
    }
  };

  const speak = () => {
    try {
      globalThis.speechSynthesis?.cancel();
      const text = data.daily?.shareLine ? `${data.daily.shareLine}\n\n${data.content.text}` : data.content.text;
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

      const palette = data.visual?.palette ?? { bg: "#0b0b12", fg: "#f4f4f5", accent: "#c4b5fd" };
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, palette.bg);
      grad.addColorStop(1, palette.accent);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const drawWrapped = (text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) => {
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

      // Sigil
      if (data.visual?.svg) {
        const blob = new Blob([data.visual.svg], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 760, 90, 240, 240);
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

      ctx.fillStyle = palette.fg;
      ctx.font = "bold 60px system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.fillText("全球边缘神谕", 72, 150);

      ctx.font = "bold 44px system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.fillText(`${scenarioLabel} · ${place}`, 72, 230);

      ctx.font = "28px system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.fillText(`${formatTemp(data.weather.temperatureC)} · ${data.weather.description || t("common.unknown")}`, 72, 290);

      ctx.globalAlpha = 0.95;
      ctx.font = "30px system-ui, -apple-system, Segoe UI, sans-serif";
      drawWrapped(data.daily?.shareLine || data.content.text.slice(0, 120), 72, 370, 936, 46, 4);
      ctx.globalAlpha = 1;

      ctx.globalAlpha = 0.85;
      ctx.font = "24px system-ui, -apple-system, Segoe UI, sans-serif";
      drawWrapped(shareUrl, 72, 1240, 936, 34, 3);
      ctx.globalAlpha = 1;

      const a = document.createElement("a");
      a.download = `edge-oracle-${Date.now()}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    } catch {
      // ignore
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative overflow-hidden rounded-3xl border border-black/10 bg-white/70 p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_20px_60px_rgba(0,0,0,0.12)] dark:border-white/10 dark:bg-white/5 dark:p-6 dark:shadow-glow"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-xs tracking-widest text-black/60 dark:text-white/60">{t("result.badge")}</div>
              <div className="rounded-full border border-black/10 bg-black/5 px-2 py-0.5 text-[11px] text-black/70 dark:border-white/15 dark:bg-black/30 dark:text-white/80">
                {scenarioLabel}
              </div>
            </div>

            <h2 className="text-lg font-semibold md:text-xl">
              {place} · {formatTemp(data.weather.temperatureC)} · {data.weather.description || t("common.unknown")}
            </h2>
            {data.daily?.shareLine ? (
              <p className="text-sm text-black/80 dark:text-white/80">{data.daily.shareLine}</p>
            ) : null}
            <p className="text-xs text-black/60 dark:text-white/60">
              {data.edge.provider} · {data.edge.node} · {t("result.cache")} {cacheLabel} · {t("result.ttl")}{" "}
              {t("result.ttlValue", { minutes: ttlMinutes })} · {t("result.geo")} {geoSourceLabel}
            </p>
            <p className="text-xs text-black/60 dark:text-white/60">{metricsLine}</p>
            <p className="text-[11px] text-black/50 dark:text-white/45">{t("result.tip")}</p>
          </div>

          <div className="flex items-start justify-end gap-3">
            {data.visual?.svg ? (
              <div className="hidden h-[92px] w-[92px] overflow-hidden rounded-2xl border border-black/10 bg-white p-1 dark:border-white/10 dark:bg-black/30 md:block">
                <div className="h-full w-full" dangerouslySetInnerHTML={{ __html: data.visual.svg }} />
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-end gap-2">
              {shareUrl ? (
                <button
                  className="h-9 rounded-xl border border-black/10 bg-black/5 px-3 text-xs text-black/75 transition hover:bg-black/10 dark:border-white/15 dark:bg-black/30 dark:text-white/85 dark:hover:bg-black/45"
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
                <button
                  className="h-9 rounded-xl border border-black/10 bg-black/5 px-3 text-xs text-black/75 transition hover:bg-black/10 dark:border-white/15 dark:bg-black/30 dark:text-white/85 dark:hover:bg-black/45"
                  onClick={() => void systemShare()}
                >
                  {t("actions.shareSystem")}
                </button>
              ) : null}

              {shareUrl ? (
                <button
                  className="h-9 rounded-xl border border-black/10 bg-black/5 px-3 text-xs text-black/75 transition hover:bg-black/10 dark:border-white/15 dark:bg-black/30 dark:text-white/85 dark:hover:bg-black/45"
                  onClick={() => void downloadPoster()}
                >
                  {t("actions.downloadPoster")}
                </button>
              ) : null}

              {speaking ? (
                <button
                  className="h-9 rounded-xl border border-black/10 bg-black/5 px-3 text-xs text-black/75 transition hover:bg-black/10 dark:border-white/15 dark:bg-black/30 dark:text-white/85 dark:hover:bg-black/45"
                  onClick={stopSpeak}
                >
                  {t("actions.stopSpeak")}
                </button>
              ) : (
                <button
                  className="h-9 rounded-xl border border-black/10 bg-black/5 px-3 text-xs text-black/75 transition hover:bg-black/10 dark:border-white/15 dark:bg-black/30 dark:text-white/85 dark:hover:bg-black/45"
                  onClick={speak}
                >
                  {t("actions.speak")}
                </button>
              )}

              <button
                className="h-9 rounded-xl border border-black/10 bg-black/5 px-3 text-xs text-black/75 transition hover:bg-black/10 disabled:opacity-60 dark:border-white/15 dark:bg-black/30 dark:text-white/85 dark:hover:bg-black/45"
                onClick={saveToHistory}
                disabled={saved}
              >
                {saved ? t("actions.saved") : t("actions.save")}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-black/30">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-black/90 dark:text-white/90">{data.content.text}</p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-black/30">
            <div className="text-xs text-black/60 dark:text-white/60">{t("result.prompt")}</div>
            <div className="mt-1 text-sm text-black/90 dark:text-white/90">{data.prompt}</div>
          </div>
          <div className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-black/30">
            <div className="text-xs text-black/60 dark:text-white/60">{t("result.ai")}</div>
            <div className="mt-1 text-sm text-black/90 dark:text-white/90">
              {t("result.aiValue", { model: data.content.model, mode: aiModeLabel })}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <LatencyChart edgeMs={edgeEndToEndMs} originSimulatedMs={data.timing.originSimulatedMs} />
        </div>
      </motion.section>

      <motion.aside
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: "easeOut", delay: 0.05 }}
        className="rounded-3xl border border-black/10 bg-white/70 p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_20px_60px_rgba(0,0,0,0.12)] dark:border-white/10 dark:bg-white/5 dark:shadow-glow"
      >
        <div className="h-[clamp(260px,36vh,360px)] overflow-hidden rounded-2xl border border-black/10 bg-white dark:border-white/10 dark:bg-black/25">
          <WorldMap
            latitude={data.location.latitude ?? 0}
            longitude={data.location.longitude ?? 0}
            city={data.location.city ?? undefined}
          />
        </div>

        <div className="mt-4 grid gap-3">
          <div className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-black/30">
            <div className="text-xs text-black/60 dark:text-white/60">{t("result.edgeCacheTitle")}</div>
            <div className="mt-1 text-sm text-black/90 dark:text-white/90">{t("result.edgeCacheDesc")}</div>
          </div>

          <div className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-black/30">
            <div className="text-xs text-black/60 dark:text-white/60">{t("result.shareTitle")}</div>
            <div className="mt-1 text-sm text-black/90 dark:text-white/90">
              {data.share?.views != null ? t("result.views", { count: data.share.views }) : t("result.viewsNA")}
            </div>
            <div className="mt-1 text-[11px] text-black/50 dark:text-white/45">
              {t("result.shareDesc")}
            </div>
          </div>

          {tasks.length ? (
            <div className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-black/30">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-black/60 dark:text-white/60">{t("daily.title")}</div>
                <button
                  className="text-[11px] text-black/55 underline underline-offset-4 dark:text-white/55"
                  onClick={resetTasks}
                >
                  {t("daily.reset")}
                </button>
              </div>
              <div className="mt-1 text-[11px] text-black/55 dark:text-white/55">
                {t("daily.progress", { done: doneCount, total: tasks.length })}
              </div>
              <div className="mt-3 space-y-2">
                {tasks.map((task) => {
                  const checked = !!taskState[task];
                  return (
                    <label key={task} className="flex cursor-pointer items-start gap-2 text-sm text-black/85 dark:text-white/85">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTask(task)}
                        className="mt-1 h-4 w-4 accent-black dark:accent-white"
                      />
                      <span className={checked ? "line-through opacity-70" : ""}>{task}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}

          {data.stats ? (
            <div className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-black/30">
              <div className="text-xs text-black/60 dark:text-white/60">{t("stats.title")}</div>
              <div className="mt-1 text-sm text-black/90 dark:text-white/90">{t("stats.global", { count: data.stats.todayGlobal })}</div>
              <div className="mt-1 text-sm text-black/90 dark:text-white/90">
                {t("stats.city", { city: data.location.city ?? t("common.unknown"), count: data.stats.todayCity })}
              </div>
            </div>
          ) : null}
        </div>
      </motion.aside>
    </div>
  );
}
