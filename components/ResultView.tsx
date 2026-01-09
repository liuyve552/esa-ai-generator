"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { GenerateResponse } from "@/lib/edge/types";
import {
  type DailyTaskEnvelope,
  type OracleHistoryEnvelope,
  type OracleHistoryItem,
  appendUserHistory,
  fetchUserDailyEnvelope,
  fetchUserHistory,
  getOrCreateAnonId,
  normalizeDailyTaskEnvelope,
  putUserDailyEnvelope,
  readLocalHistory,
  readLocalJson,
  writeLocalHistory,
  writeLocalJson
} from "@/lib/userStorage";

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

function toReadablePlace(location: GenerateResponse["location"], fallback: string) {
  return [location.city, location.country].filter((v): v is string => typeof v === "string" && v.length > 0).join(", ") || fallback;
}

function formatMs(ms: number | null | undefined) {
  return typeof ms === "number" && Number.isFinite(ms) ? `${Math.max(0, Math.round(ms))}ms` : null;
}

export type ResultTechState = {
  uid: string | null;
  daily: { sync: "edge" | "local" };
  history: { sync: "edge" | "local"; size: number };
};

export default function ResultView(props: {
  data: GenerateResponse;
  sharedId?: string;
  clientApiMs?: number;
  streaming?: boolean;
  onTechState?: (state: ResultTechState) => void;
}) {
  const { data, sharedId, streaming, onTechState } = props;
  const { t } = useTranslation();

  const posterRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [posterBusy, setPosterBusy] = useState(false);
  const [taskState, setTaskState] = useState<Record<string, boolean>>({});
  const [dailySync, setDailySync] = useState<"edge" | "local">("local");
  const dailySaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [history, setHistory] = useState<OracleHistoryEnvelope | null>(null);
  const [historySync, setHistorySync] = useState<"edge" | "local">("local");
  const lastHistoryIdRef = useRef<string | null>(null);

  const streamingEnabled = streaming === true;
  const renderedText = data.content.text || "";
  const uid = useMemo(() => getOrCreateAnonId(), []);

  const formatTemp = (value: number | null | undefined) => {
    if (typeof value !== "number" || Number.isNaN(value)) return t("common.na");
    return `${Math.round(value)}°C`;
  };

  const place = useMemo(() => toReadablePlace(data.location, t("common.unknown")), [data.location, t]);
  const scenarioKey = (data.mode ?? "oracle").toString();
  const scenarioLabel = t(`mode.${scenarioKey}`, { defaultValue: scenarioKey });

  const weatherKind = pickWeatherKind(data.weather.weatherCode);
  const isZh = (data.lang || "").toLowerCase().startsWith("zh");

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("weather-clear", "weather-cloud");
    if (weatherKind === "clear") root.classList.add("weather-clear");
    if (weatherKind === "cloud") root.classList.add("weather-cloud");
    return () => root.classList.remove("weather-clear", "weather-cloud");
  }, [weatherKind]);

  const cardTheme = useMemo(() => {
    if (weatherKind === "clear") {
      return {
        base: "bg-[#0b1220]/55",
        glowA: "bg-[radial-gradient(circle_at_18%_16%,rgba(56,189,248,0.18),transparent_60%)]",
        glowB: "bg-[radial-gradient(circle_at_85%_0%,rgba(125,211,252,0.16),transparent_55%)]"
      };
    }
    if (weatherKind === "cloud") {
      return {
        base: "bg-[#111827]/60",
        glowA: "bg-[radial-gradient(circle_at_18%_16%,rgba(148,163,184,0.16),transparent_60%)]",
        glowB: "bg-[radial-gradient(circle_at_85%_0%,rgba(71,85,105,0.45),transparent_55%)]"
      };
    }
    return {
      base: "bg-[#0b0b12]/65",
      glowA: "bg-[radial-gradient(circle_at_18%_16%,rgba(46,16,101,0.55),transparent_60%)]",
      glowB: "bg-[radial-gradient(circle_at_85%_0%,rgba(249,115,22,0.12),transparent_55%)]"
    };
  }, [weatherKind]);

  const weatherSummary = useMemo(() => {
    const desc = data.weather.description || t("common.unknown");
    const temp = formatTemp(data.weather.temperatureC);
    return isZh ? `${desc}\uff0c${temp}` : `${desc}, ${temp}`;
  }, [data.weather.description, data.weather.temperatureC, formatTemp, isZh, t]);

  // Cache layer badge (kv.txt):
  // “缓存命中：内存 (0ms)” / “缓存命中：KV (12ms)” / “实时生成 (1281ms)”
  const cacheBadge = useMemo(() => {
    const layer = data.cache.layer ?? (data.cache.hit ? "unknown" : "generate");
    const ms = formatMs(data.cache.layerMs);

    if (isZh) {
      if (data.cache.hit && layer === "memory") return `缓存命中：内存${ms ? ` (${ms})` : ""}`;
      if (data.cache.hit && layer === "kv") return `缓存命中：KV${ms ? ` (${ms})` : ""}`;
      if (data.cache.hit && layer === "edge") return `缓存命中：Edge${ms ? ` (${ms})` : ""}`;
      if (!data.cache.hit) return `实时生成${ms ? ` (${ms})` : ""}`;
      return `缓存命中${ms ? ` (${ms})` : ""}`;
    }

    if (data.cache.hit && layer === "memory") return `Cache: memory${ms ? ` (${ms})` : ""}`;
    if (data.cache.hit && layer === "kv") return `Cache: KV${ms ? ` (${ms})` : ""}`;
    if (data.cache.hit && layer === "edge") return `Cache: edge${ms ? ` (${ms})` : ""}`;
    if (!data.cache.hit) return `Live generation${ms ? ` (${ms})` : ""}`;
    return `Cache${ms ? ` (${ms})` : ""}`;
  }, [data.cache.hit, data.cache.layer, data.cache.layerMs, isZh]);

  // Global POP node badge (kv.txt): "由香港节点提供服务 · 距离约50km · 边缘延迟170ms"
  const popBadge = useMemo(() => {
    const popName =
      data.edge.pop?.city || (data.edge.node && data.edge.node !== "near-user" ? String(data.edge.node) : null);
    if (!popName) return null;

    const parts: string[] = [];
    parts.push(isZh ? `由${popName}节点提供服务` : `Served by ${popName}`);

    const distanceKm = data.edge.pop?.distanceKm;
    if (typeof distanceKm === "number" && Number.isFinite(distanceKm)) {
      parts.push(isZh ? `距离约${Math.round(distanceKm)}km` : `~${Math.round(distanceKm)}km away`);
    }

    const edgeLatencyMs =
      typeof props.clientApiMs === "number"
        ? props.clientApiMs
        : !streamingEnabled
          ? data.timing.totalMs
          : null;
    if (typeof edgeLatencyMs === "number" && Number.isFinite(edgeLatencyMs)) {
      parts.push(isZh ? `边缘延迟${Math.round(edgeLatencyMs)}ms` : `Edge latency ${Math.round(edgeLatencyMs)}ms`);
    }

    return parts.join(" \u00b7 ");
  }, [data.edge.node, data.edge.pop?.city, data.edge.pop?.distanceKm, data.timing.totalMs, isZh, props.clientApiMs, streamingEnabled]);

  const shareUrl = useMemo(() => {
    const origin = globalThis.location?.origin ?? "";
    const fromApi = data.share?.url;
    if (fromApi) return `${origin}${fromApi}`;
    const id = sharedId ?? data.share?.id;
    if (!id) return null;
    return `${origin}/s/?id=${id}`;
  }, [data.share?.id, data.share?.url, sharedId]);

  const dailyDate = useMemo(
    () => (data.daily?.date || data.generatedAt.slice(0, 10)).slice(0, 10),
    [data.daily?.date, data.generatedAt]
  );
  const dailyCity = useMemo(() => data.location.city || "unknown", [data.location.city]);

  const dailyKey = useMemo(() => {
    return `esa:daily:${dailyDate}:${scenarioKey}:${dailyCity}`;
  }, [dailyCity, dailyDate, scenarioKey]);

  useEffect(() => {
    if (!data.daily?.tasks?.length) return;

    const local = normalizeDailyTaskEnvelope(readLocalJson(dailyKey));
    setTaskState(local?.state ?? {});
    setDailySync("local");

    if (!uid) return;
    let cancelled = false;

    void fetchUserDailyEnvelope({ uid, date: dailyDate, mode: scenarioKey, city: dailyCity }).then((remote) => {
      if (cancelled || !remote) return;
      setDailySync("edge");
      if (!local || remote.updatedAt > local.updatedAt) {
        setTaskState(remote.state);
        writeLocalJson(dailyKey, remote);
      }
    });

    return () => {
      cancelled = true;
      if (dailySaveRef.current) clearTimeout(dailySaveRef.current);
      dailySaveRef.current = null;
    };
  }, [dailyCity, dailyDate, dailyKey, data.daily?.tasks?.length, scenarioKey, uid]);

  const tasks = data.daily?.tasks ?? [];
  const doneCount = tasks.reduce((acc, task) => acc + (taskState[task] ? 1 : 0), 0);

  const persistDaily = (nextState: Record<string, boolean>) => {
    const envelope: DailyTaskEnvelope = { v: 1, updatedAt: Date.now(), state: nextState };
    setTaskState(nextState);
    writeLocalJson(dailyKey, envelope);

    if (!uid) return;
    setDailySync("local");
    if (dailySaveRef.current) clearTimeout(dailySaveRef.current);
    dailySaveRef.current = setTimeout(() => {
      void putUserDailyEnvelope({ uid, date: dailyDate, mode: scenarioKey, city: dailyCity, envelope }).then((ok) => {
        if (ok) setDailySync("edge");
      });
    }, 500);
  };

  const toggleTask = (task: string) => {
    persistDaily({ ...taskState, [task]: !taskState[task] });
  };

  const resetTasks = () => {
    persistDaily({});
  };

  // Oracle history (privacy-safe, EdgeKV + localStorage, TTL>=7d)
  useEffect(() => {
    const local = readLocalHistory() ?? { v: 1 as const, updatedAt: 0, items: [] };
    setHistory(local);
    setHistorySync("local");

    if (!uid) return;
    let cancelled = false;

    void fetchUserHistory({ uid }).then((remote) => {
      if (cancelled || !remote) return;
      setHistorySync("edge");
      setHistory((prev) => {
        const chosen = !prev || remote.updatedAt > prev.updatedAt ? remote : prev;
        writeLocalHistory(chosen);
        return chosen;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [uid]);

  useEffect(() => {
    const historyId = data.share?.id ?? sharedId;
    if (!uid || !shareUrl || !historyId) return;
    if (lastHistoryIdRef.current === historyId) return;
    lastHistoryIdRef.current = historyId;

    const item: OracleHistoryItem = {
      id: historyId,
      url: shareUrl,
      at: Date.now(),
      date: dailyDate,
      mode: String(data.mode || "oracle"),
      place,
      weather: weatherSummary,
      shareLine: data.daily?.shareLine ?? null
    };

    setHistory((prev) => {
      const base: OracleHistoryEnvelope = prev ?? { v: 1, updatedAt: 0, items: [] };
      const items = [item, ...base.items.filter((x) => x.id !== item.id)].slice(0, 12);
      const next: OracleHistoryEnvelope = { v: 1, updatedAt: Date.now(), items };
      writeLocalHistory(next);
      return next;
    });

    void appendUserHistory({ uid, item }).then((ok) => {
      if (ok) setHistorySync("edge");
    });
  }, [dailyDate, data.daily?.shareLine, data.mode, data.share?.id, place, sharedId, shareUrl, uid, weatherSummary]);

  useEffect(() => {
    if (!onTechState) return;
    onTechState({
      uid,
      daily: { sync: dailySync },
      history: { sync: historySync, size: history?.items.length ?? 0 }
    });
  }, [dailySync, history?.items.length, historySync, onTechState, uid]);

  const downloadPoster = async () => {
    if (!posterRef.current || posterBusy) return;
    const target = posterRef.current;
    try {
      setPosterBusy(true);

      const render = async (ignoreMap: boolean) => {
        const html2canvas = (await import("html2canvas")).default;
        return await html2canvas(target, {
          backgroundColor: null,
          scale: 2,
          useCORS: true,
          logging: false,
          ignoreElements: (el) => {
            if (!ignoreMap) return false;
            if (!(el instanceof HTMLElement)) return false;
            return el.classList.contains("leaflet-container");
          }
        });
      };

      let canvas: HTMLCanvasElement;
      try {
        canvas = await render(false);
      } catch {
        canvas = await render(true);
      }

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.download = `edge-oracle-${Date.now()}.png`;
      a.href = url;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);

      if (shareUrl) {
        try {
          await navigator.clipboard.writeText(shareUrl);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    } finally {
      setPosterBusy(false);
    }
  };

  const posterButton =
    "inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-[#F97316] to-[#fb8531] px-5 text-sm font-semibold text-white shadow-[0_12px_40px_rgba(249,115,22,0.32)] ring-1 ring-white/10 transition duration-100 hover:brightness-105 hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[#F97316]/45 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="space-y-4"
    >
      <div
        ref={posterRef}
        className={`relative overflow-hidden rounded-3xl border border-white/10 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur ${cardTheme.base}`}
      >
        <div className={`absolute inset-0 ${cardTheme.glowA}`} />
        <div className={`absolute inset-0 ${cardTheme.glowB}`} />

        <div className="relative">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <WeatherGlyph kind={weatherKind} />
                <div className="leading-tight">
                  <div className="text-xs tracking-widest text-white/55">{scenarioLabel}</div>
                  <h2 className="text-2xl font-semibold text-white">{place}</h2>
                  <div className="mt-1 text-sm text-white/70">{weatherSummary}</div>
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
              {renderedText}
              {streamingEnabled ? (
                <motion.span
                  aria-hidden
                  className="ml-1 inline-block h-[1.05em] w-[2px] translate-y-[2px] bg-[#F97316]/90"
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
                />
              ) : null}
            </p>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {cacheBadge ? (
              <span className="inline-flex items-center rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] text-white/70">
                {cacheBadge}
              </span>
            ) : null}
            {popBadge ? (
              <span className="inline-flex items-center rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] text-white/70">
                {popBadge}
              </span>
            ) : null}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-black/20"
          >
            <div className="h-[200px] w-full md:h-[240px]">
              <WorldMap
                latitude={data.location.latitude ?? 0}
                longitude={data.location.longitude ?? 0}
                city={data.location.city ?? undefined}
              />
            </div>
          </motion.div>
        </div>
      </div>

      {tasks.length ? (
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(var(--esa-weather-aura-1),0.12),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgba(var(--esa-weather-aura-2),0.22),transparent_55%)]" />
          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-white/90">{t("daily.title")}</div>
              <button
                className="text-xs text-white/60 underline underline-offset-4 transition hover:text-white/85"
                onClick={resetTasks}
              >
                {t("daily.reset")}
              </button>
            </div>
            <div className="mt-1 text-xs text-white/60">{t("daily.progress", { done: doneCount, total: tasks.length })}</div>
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
        </div>
      ) : null}

      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-3 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_20%,rgba(var(--esa-accent-rgb),0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_86%_60%,rgba(var(--esa-weather-aura-2),0.18),transparent_60%)]" />
        <div className="relative flex items-center gap-3">
          <button className={posterButton} onClick={() => void downloadPoster()} disabled={posterBusy}>
            {posterBusy ? t("home.loading") : t("actions.downloadPoster")}
          </button>
          {copied ? <span className="text-xs text-white/65">{t("result.copied")}</span> : null}
        </div>
      </div>
    </motion.section>
  );
}
