"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { GenerateResponse } from "@/lib/edge/types";
import {
  appendUserHistory,
  fetchUserDailyEnvelope,
  fetchUserHistory,
  fetchUserTracker,
  getOrCreateAnonId,
  normalizeDailyTaskEnvelope,
  normalizeMoodTrackerEnvelope,
  putUserDailyEnvelope,
  putUserTracker,
  readLocalHistory,
  readLocalJson,
  removeLocal,
  writeLocalHistory,
  writeLocalJson,
  type DailyTaskEnvelope,
  type OracleHistoryEnvelope,
  type OracleHistoryItem,
  type MoodTrackerEnvelope
} from "@/lib/userStorage";

const WorldMap = dynamic(() => import("@/components/WorldMap"), { ssr: false });

type WeatherKind = "clear" | "rain" | "snow" | "fog" | "cloud";

const WEATHER_ROOT_CLASSES = [
  "weather-clear",
  "weather-cloud",
  "weather-rain",
  "weather-snow",
  "weather-fog",
  "weather-night"
] as const;

const TRACKER_LOCAL_KEY = "esa:tracker:v1";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateKeyUtc(dateKey: string): Date | null {
  if (!DATE_KEY_RE.test(dateKey)) return null;
  const dt = new Date(`${dateKey}T00:00:00Z`);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function formatDateKeyUtc(dt: Date) {
  return dt.toISOString().slice(0, 10);
}

function lastNDaysKeys(todayKey: string, n: number) {
  const dt = parseDateKeyUtc(todayKey);
  if (!dt) return [];
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(dt);
    d.setUTCDate(dt.getUTCDate() - i);
    out.push(formatDateKeyUtc(d));
  }
  return out;
}

function clampTrackerDays(days: Record<string, { mood: string; moodText?: string | null; updatedAt: number }>, keep: number) {
  const keys = Object.keys(days).filter((k) => DATE_KEY_RE.test(k)).sort();
  const keepKeys = keys.slice(-keep);
  const out: Record<string, { mood: string; moodText?: string | null; updatedAt: number }> = {};
  for (const k of keepKeys) {
    const v = days[k];
    if (v) out[k] = v;
  }
  return out;
}

function pickWeatherKind(weatherCode: number | null | undefined): WeatherKind {
  if (weatherCode == null) return "cloud";
  if (weatherCode === 0 || weatherCode === 1) return "clear";
  if (weatherCode === 45 || weatherCode === 48) return "fog";
  if (weatherCode === 71 || weatherCode === 73 || weatherCode === 75 || weatherCode === 77 || weatherCode === 85 || weatherCode === 86)
    return "snow";
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
  const className =
    kind === "clear"
      ? "text-[#F97316]"
      : kind === "rain"
        ? "text-sky-300"
        : kind === "snow"
          ? "text-slate-100"
          : kind === "fog"
            ? "text-slate-200"
            : "text-white/70";

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
      ) : kind === "snow" ? (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <path
            d="M7 16.5h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M9 19.2h.01M12 20h.01M15 19.2h.01"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
      ) : kind === "fog" ? (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <path
            d="M7 13.5h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M6 16.8h12M7.5 19h9"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.9"
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

export default function ResultView(props: {
  data: GenerateResponse;
  sharedId?: string;
  clientApiMs?: number;
  streaming?: boolean;
}) {
  const { data, sharedId, streaming } = props;
  const { t } = useTranslation();

  const posterRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [posterBusy, setPosterBusy] = useState(false);
  const [taskState, setTaskState] = useState<Record<string, boolean>>({});
  const [dailySync, setDailySync] = useState<"edge" | "local">("local");
  const dailySaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [tracker, setTracker] = useState<MoodTrackerEnvelope | null>(null);
  const [trackerSync, setTrackerSync] = useState<"edge" | "local">("local");
  const trackerSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [history, setHistory] = useState<OracleHistoryEnvelope | null>(null);
  const [historySync, setHistorySync] = useState<"edge" | "local">("local");
  const lastHistoryIdRef = useRef<string | null>(null);

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

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
    root.classList.remove(...WEATHER_ROOT_CLASSES);
    root.classList.add(`weather-${weatherKind}`);
    if (data.weather.isDay === false) root.classList.add("weather-night");
    return () => root.classList.remove(...WEATHER_ROOT_CLASSES);
  }, [data.weather.isDay, weatherKind]);

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
    if (weatherKind === "rain") {
      return {
        base: "bg-[#07121f]/62",
        glowA: "bg-[radial-gradient(circle_at_18%_16%,rgba(56,189,248,0.16),transparent_60%)]",
        glowB: "bg-[radial-gradient(circle_at_85%_0%,rgba(2,132,199,0.18),transparent_55%)]"
      };
    }
    if (weatherKind === "snow") {
      return {
        base: "bg-[#0b1220]/52",
        glowA: "bg-[radial-gradient(circle_at_18%_16%,rgba(226,232,240,0.16),transparent_60%)]",
        glowB: "bg-[radial-gradient(circle_at_85%_0%,rgba(148,163,184,0.20),transparent_55%)]"
      };
    }
    if (weatherKind === "fog") {
      return {
        base: "bg-[#0b0b12]/62",
        glowA: "bg-[radial-gradient(circle_at_18%_16%,rgba(203,213,225,0.12),transparent_60%)]",
        glowB: "bg-[radial-gradient(circle_at_85%_0%,rgba(71,85,105,0.22),transparent_55%)]"
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
    const ms = formatMs(data.cache.layerMs) ?? (data.cache.hit ? "0ms" : null);
    const popName = data.edge.pop?.city || (data.edge.node && data.edge.node !== "near-user" ? String(data.edge.node) : null);

    const zhLayer = layer === "memory" ? "内存" : layer === "kv" ? "KV" : layer === "edge" ? "Edge" : "缓存";
    const enLayer = layer === "memory" ? "memory" : layer === "kv" ? "KV" : layer === "edge" ? "edge" : "cache";

    if (isZh) {
      if (data.cache.hit) {
        const from = popName ? ` · ${popName}` : "";
        return `缓存命中：${zhLayer}${ms ? ` (${ms})` : ""}${from}`;
      }
      return `实时生成${ms ? ` (${ms})` : ""}`;
    }

    if (data.cache.hit) {
      const from = popName ? ` from ${popName}` : "";
      return `Cache hit: ${enLayer}${ms ? ` (${ms})` : ""}${from}`;
    }
    return `Live generation${ms ? ` (${ms})` : ""}`;
  }, [data.cache.hit, data.cache.layer, data.cache.layerMs, data.edge.node, data.edge.pop?.city, isZh]);

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

  useEffect(() => {
    setQrDataUrl(null);
    if (!shareUrl) return;

    let cancelled = false;
    void import("qrcode")
      .then(async (m) => {
        const QRCode = m.default ?? m;
        const url = await QRCode.toDataURL(shareUrl, {
          width: 220,
          margin: 1,
          color: { dark: "#FFFFFF", light: "#00000000" }
        });
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => null);

    return () => {
      cancelled = true;
    };
  }, [shareUrl]);

  useEffect(() => {
    if (!toast) return;
    const tmr = setTimeout(() => setToast(null), 1400);
    return () => clearTimeout(tmr);
  }, [toast]);

  const dailyKey = useMemo(() => {
    const date = data.daily?.date || data.generatedAt.slice(0, 10);
    const city = data.location.city || "unknown";
    return `esa:daily:${date}:${scenarioKey}:${city}`;
  }, [data.daily?.date, data.generatedAt, data.location.city, scenarioKey]);

  useEffect(() => {
    const tasks = data.daily?.tasks ?? [];
    if (!tasks.length) {
      setTaskState({});
      return;
    }

    const local = normalizeDailyTaskEnvelope(readLocalJson(dailyKey));
    const filterToTasks = (state: Record<string, boolean>) => {
      const next: Record<string, boolean> = {};
      for (const task of tasks) if (state[task]) next[task] = true;
      return next;
    };

    setDailySync("local");
    setTaskState(local ? filterToTasks(local.state) : {});

    const date = data.daily?.date || data.generatedAt.slice(0, 10);
    const city = data.location.city || "unknown";
    if (!uid) return;

    let cancelled = false;
    void fetchUserDailyEnvelope({ uid, date, mode: scenarioKey, city }).then((remote) => {
      if (cancelled || !remote) return;
      setDailySync("edge");

      const chosen = !local || remote.updatedAt > local.updatedAt ? remote : local;
      writeLocalJson(dailyKey, chosen);
      setTaskState(filterToTasks(chosen.state));
    });

    return () => {
      cancelled = true;
    };
  }, [dailyKey, data.daily?.date, data.daily?.tasks, data.generatedAt, data.location.city, scenarioKey, uid]);

  const tasks = data.daily?.tasks ?? [];
  const doneCount = tasks.reduce((acc, task) => acc + (taskState[task] ? 1 : 0), 0);

  const toggleTask = (task: string) => {
    const next = { ...taskState, [task]: !taskState[task] };
    setTaskState(next);

    const envelope: DailyTaskEnvelope = { v: 1, updatedAt: Date.now(), state: next };
    writeLocalJson(dailyKey, envelope);

    const date = data.daily?.date || data.generatedAt.slice(0, 10);
    const city = data.location.city || "unknown";
    if (!uid) return;

    if (dailySaveRef.current) clearTimeout(dailySaveRef.current);
    dailySaveRef.current = setTimeout(() => {
      void putUserDailyEnvelope({ uid, date, mode: scenarioKey, city, envelope }).then((ok) => {
        if (ok) setDailySync("edge");
      });
    }, 350);
  };

  const resetTasks = () => {
    setTaskState({});
    removeLocal(dailyKey);

    const date = data.daily?.date || data.generatedAt.slice(0, 10);
    const city = data.location.city || "unknown";
    if (!uid) return;

    const envelope: DailyTaskEnvelope = { v: 1, updatedAt: Date.now(), state: {} };
    void putUserDailyEnvelope({ uid, date, mode: scenarioKey, city, envelope }).then((ok) => {
      if (ok) setDailySync("edge");
    });
  };

  // 7-day mood tracker (localStorage + EdgeKV)
  useEffect(() => {
    const local = normalizeMoodTrackerEnvelope(readLocalJson(TRACKER_LOCAL_KEY)) ?? { v: 1 as const, updatedAt: 0, days: {} };
    setTracker(local);
    setTrackerSync("local");

    if (!uid) return;
    let cancelled = false;
    void fetchUserTracker({ uid }).then((remote) => {
      if (cancelled || !remote) return;
      setTrackerSync("edge");
      setTracker((prev) => {
        const chosen = !prev || remote.updatedAt > prev.updatedAt ? remote : prev;
        writeLocalJson(TRACKER_LOCAL_KEY, chosen);
        return chosen;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [uid]);

  useEffect(() => {
    const dateKey = data.daily?.date || data.generatedAt.slice(0, 10);
    if (!DATE_KEY_RE.test(dateKey)) return;

    const mood = String(data.mood || "auto");
    const moodText = typeof data.moodText === "string" ? data.moodText : null;
    const updatedAt = Date.now();

    setTracker((prev) => {
      const base = prev ?? { v: 1 as const, updatedAt: 0, days: {} };
      const nextDays = clampTrackerDays(
        { ...base.days, [dateKey]: { mood, moodText, updatedAt } },
        14
      );
      const next: MoodTrackerEnvelope = { v: 1, updatedAt, days: nextDays };
      writeLocalJson(TRACKER_LOCAL_KEY, next);

      if (!uid) return next;
      if (trackerSaveRef.current) clearTimeout(trackerSaveRef.current);
      trackerSaveRef.current = setTimeout(() => {
        void putUserTracker({ uid, tracker: next }).then((ok) => {
          if (ok) setTrackerSync("edge");
        });
      }, 500);

      return next;
    });
  }, [data.daily?.date, data.generatedAt, data.mood, data.moodText, uid]);

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
    const shareId = data.share?.id;
    if (!uid || !shareUrl || !shareId) return;
    if (lastHistoryIdRef.current === shareId) return;
    lastHistoryIdRef.current = shareId;

    const item: OracleHistoryItem = {
      id: shareId,
      url: shareUrl,
      at: Date.now(),
      date: (data.daily?.date || data.generatedAt.slice(0, 10)).slice(0, 10),
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
  }, [data.daily?.date, data.daily?.shareLine, data.generatedAt, data.mode, data.share?.id, place, shareUrl, uid, weatherSummary]);

  const trackerTodayKey = useMemo(() => {
    const v = data.daily?.date || data.generatedAt.slice(0, 10);
    return DATE_KEY_RE.test(v) ? v : null;
  }, [data.daily?.date, data.generatedAt]);

  const streakDays = useMemo(() => {
    if (!trackerTodayKey || !tracker?.days) return 0;
    const dt = parseDateKeyUtc(trackerTodayKey);
    if (!dt) return 0;
    let streak = 0;
    for (let i = 0; i < 14; i++) {
      const d = new Date(dt);
      d.setUTCDate(dt.getUTCDate() - i);
      const k = formatDateKeyUtc(d);
      if (tracker.days[k]) streak++;
      else break;
    }
    return streak;
  }, [tracker?.days, trackerTodayKey]);

  const wechatText = useMemo(() => {
    if (!shareUrl) return null;
    const lines: string[] = [];
    if (data.daily?.shareLine) lines.push(data.daily.shareLine);
    lines.push(`${scenarioLabel} · ${place} · ${weatherSummary}`);
    if (tasks.length) lines.push(isZh ? `今日任务：${doneCount}/${tasks.length}` : `Today's quests: ${doneCount}/${tasks.length}`);
    lines.push(isZh ? "打开链接复测（含快照）：" : "Replay via link (snapshot embedded):");
    lines.push(shareUrl);
    return lines.join("\n");
  }, [data.daily?.shareLine, doneCount, isZh, place, scenarioLabel, shareUrl, tasks.length, weatherSummary]);

  const challengeUrl = useMemo(() => {
    const origin = globalThis.location?.origin ?? "";
    if (!origin) return null;
    const url = new URL("/", origin);
    url.searchParams.set("challenge", "1");
    url.searchParams.set("lang", data.lang || "zh");
    url.searchParams.set("mode", String(data.mode || "oracle"));
    url.searchParams.set("mood", String(data.mood || "neutral"));
    if (data.mood === "custom" && data.moodText) url.searchParams.set("moodText", String(data.moodText));
    return url.toString();
  }, [data.lang, data.mode, data.mood, data.moodText]);

  const posterPrompt = useMemo(() => {
    const moodLabel = data.mood === "custom" && data.moodText ? data.moodText : t(`mood.${String(data.mood || "neutral")}`);
    const where = place || (isZh ? "你的城市" : "your city");
    const weather = weatherSummary || (isZh ? "实时天气" : "live weather");

    if (isZh) {
      return [
        "神秘主义风格海报，电影级光影，细腻颗粒与星尘，深色渐变背景，边缘辉光与雾气层叠，",
        `主题：全球边缘神谕；地点：${where}；天气：${weather}；情绪：${moodLabel}。`,
        "元素：抽象符印（sigil）/几何纹章/微光文字排版；风格：极简、克制、可读。",
        "画幅：竖版 4:5 或 9:16，高对比但不刺眼，留白充足。"
      ].join("");
    }

    return [
      "Mystic editorial poster, cinematic lighting, subtle film grain & stardust, dark gradient background, edge glow and layered fog, ",
      `Theme: Global Edge Oracle; Place: ${where}; Weather: ${weather}; Mood: ${moodLabel}. `,
      "Elements: abstract sigil / geometric emblem / soft typography; minimal yet readable; ",
      "Aspect ratio: 4:5 or 9:16."
    ].join("");
  }, [data.mood, data.moodText, isZh, place, t, weatherSummary]);

  const copyText = async (text: string | null, okToast: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setToast(okToast);
    } catch {
      // Fallback: best-effort prompt
      try {
        // eslint-disable-next-line no-alert
        window.prompt(okToast, text);
      } catch {
        // ignore
      }
    }
  };

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

        {data.visual?.svg ? (
          <div className="pointer-events-none absolute -right-16 -top-16 h-[260px] w-[260px] rotate-[18deg] opacity-[0.14] blur-[0.2px] mix-blend-soft-light">
            <div className="h-full w-full" dangerouslySetInnerHTML={{ __html: data.visual.svg }} />
          </div>
        ) : null}

        {qrDataUrl ? (
          <div className="absolute bottom-5 right-5 z-20 rounded-2xl border border-white/10 bg-black/35 p-2 backdrop-blur">
            <img className="h-[78px] w-[78px]" src={qrDataUrl} alt={t("share.qrHint")} />
            <div className="mt-1 text-center text-[10px] text-white/70">{t("share.qrHint")}</div>
          </div>
        ) : null}

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
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut", delay: 0.06 }}
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(var(--esa-weather-aura-1),0.12),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgba(var(--esa-weather-aura-2),0.22),transparent_55%)]" />
          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white/90">{t("daily.title")}</div>
                <div className="mt-0.5 text-[11px] text-white/55">
                  {dailySync === "edge" ? t("daily.sync.edge") : t("daily.sync.local")}
                </div>
              </div>
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
        </motion.div>
      ) : null}

      {trackerTodayKey ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut", delay: 0.1 }}
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_20%,rgba(var(--esa-weather-aura-2),0.12),transparent_65%)]" />
          <div className="relative">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white/90">{t("tracker.title")}</div>
                <div className="mt-1 text-xs text-white/60">{t("tracker.streak", { days: streakDays })}</div>
              </div>
              <div className="text-[11px] text-white/55">{trackerSync === "edge" ? t("tracker.sync.edge") : t("tracker.sync.local")}</div>
            </div>

            <div className="mt-4 grid grid-cols-7 gap-2">
              {lastNDaysKeys(trackerTodayKey, 7).map((k) => {
                const entry = tracker?.days?.[k];
                const mood = entry?.mood ?? "";
                const moodClass =
                  mood === "happy"
                    ? "bg-orange-400/25 ring-orange-300/30 text-orange-200"
                    : mood === "calm"
                      ? "bg-sky-400/20 ring-sky-300/25 text-sky-200"
                      : mood === "anxious"
                        ? "bg-rose-400/20 ring-rose-300/25 text-rose-200"
                        : mood === "tired"
                          ? "bg-violet-400/18 ring-violet-300/25 text-violet-200"
                          : mood === "custom"
                            ? "bg-emerald-400/18 ring-emerald-300/25 text-emerald-200"
                            : mood === "neutral" || mood === "auto"
                              ? "bg-white/10 ring-white/15 text-white/70"
                              : "bg-white/5 ring-white/10 text-white/50";

                const label = entry
                  ? mood === "custom" && entry.moodText
                    ? entry.moodText
                    : t(`mood.${mood}`, { defaultValue: mood || t("common.na") })
                  : t("common.na");

                return (
                  <div key={k} className="flex flex-col items-center gap-1">
                    <div
                      title={`${k} · ${label}`}
                      className={`flex h-9 w-9 items-center justify-center rounded-2xl ring-1 ${moodClass}`}
                    >
                      <span className="text-[11px] font-semibold">{entry ? k.slice(8, 10) : "–"}</span>
                    </div>
                    <div className="text-[10px] text-white/55">{k.slice(8, 10)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      ) : null}

      {shareUrl ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut", delay: 0.14 }}
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(var(--esa-accent-rgb),0.10),transparent_62%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_86%_70%,rgba(var(--esa-weather-aura-2),0.14),transparent_60%)]" />
          <div className="relative flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white/90">{t("share.title")}</div>
              <div className="mt-1 text-xs text-white/60">{t("share.desc")}</div>

              {wechatText ? (
                <pre className="mt-3 max-w-full whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/25 p-3 text-[12px] leading-relaxed text-white/80">
                  {wechatText}
                </pre>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  className="inline-flex h-10 items-center justify-center rounded-2xl bg-white/10 px-4 text-sm font-semibold text-white/85 ring-1 ring-white/10 transition hover:bg-white/15"
                  onClick={() => void copyText(shareUrl, t("share.copiedLink"))}
                >
                  {t("result.copyShare")}
                </button>
                <button
                  className="inline-flex h-10 items-center justify-center rounded-2xl bg-white/10 px-4 text-sm font-semibold text-white/85 ring-1 ring-white/10 transition hover:bg-white/15"
                  onClick={() => void copyText(wechatText, t("share.copiedWeChat"))}
                  disabled={!wechatText}
                >
                  {t("share.copyWeChat")}
                </button>
                <button
                  className="inline-flex h-10 items-center justify-center rounded-2xl bg-white/10 px-4 text-sm font-semibold text-white/85 ring-1 ring-white/10 transition hover:bg-white/15"
                  onClick={() => void copyText(challengeUrl, t("share.copiedChallenge"))}
                  disabled={!challengeUrl}
                >
                  {t("share.challenge")}
                </button>
              </div>

              <div className="mt-3">
                <div className="text-xs font-semibold text-white/80">{t("share.posterPromptTitle")}</div>
                <pre className="mt-1 whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/25 p-3 text-[12px] leading-relaxed text-white/75">
                  {posterPrompt}
                </pre>
                <button
                  className="mt-2 inline-flex h-9 items-center justify-center rounded-2xl bg-white/10 px-4 text-xs font-semibold text-white/85 ring-1 ring-white/10 transition hover:bg-white/15"
                  onClick={() => void copyText(posterPrompt, t("share.copiedPosterPrompt"))}
                >
                  {t("share.copyPosterPrompt")}
                </button>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold text-white/80">{t("history.title")}</div>
                  <div className="text-[11px] text-white/55">
                    {historySync === "edge" ? t("history.sync.edge") : t("history.sync.local")}
                  </div>
                </div>

                {history?.items?.length ? (
                  <div className="mt-2 space-y-1">
                    {history.items.slice(0, 5).map((it) => (
                      <a
                        key={it.id}
                        className="block rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/80 hover:bg-black/30"
                        href={it.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-white/90">{it.date}</span>
                          {it.place ? <span className="text-white/70">{it.place}</span> : null}
                          {it.mode ? <span className="text-white/55">· {it.mode}</span> : null}
                        </div>
                        {it.shareLine ? <div className="mt-1 text-white/60">{it.shareLine}</div> : null}
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-white/55">{t("history.empty")}</div>
                )}
              </div>
            </div>

            {qrDataUrl ? (
              <div className="shrink-0 rounded-3xl border border-white/10 bg-black/25 p-3">
                <img className="h-[132px] w-[132px]" src={qrDataUrl} alt={t("share.qrHint")} />
                <div className="mt-2 text-center text-xs text-white/60">{t("share.qrHint")}</div>
              </div>
            ) : null}
          </div>
        </motion.div>
      ) : null}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut", delay: 0.18 }}
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-3 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_20%,rgba(var(--esa-accent-rgb),0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_86%_60%,rgba(var(--esa-weather-aura-2),0.18),transparent_60%)]" />
        <div className="relative flex items-center gap-3">
          <button className={posterButton} onClick={() => void downloadPoster()} disabled={posterBusy}>
            {posterBusy ? t("home.loading") : t("actions.downloadPoster")}
          </button>
          {copied ? <span className="text-xs text-white/65">{t("result.copied")}</span> : null}
          {toast ? <span className="text-xs text-white/65">{toast}</span> : null}
        </div>
      </motion.div>
    </motion.section>
  );
}
