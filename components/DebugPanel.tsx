"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import PerformanceComparison from "@/components/PerformanceComparison";
import type { GenerateResponse } from "@/lib/edge/types";
import type { ResultTechState } from "@/components/ResultView";

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function DebugPanel({
  data,
  clientApiMs,
  techState,
  onClose
}: {
  data: GenerateResponse;
  clientApiMs?: number;
  techState?: ResultTechState;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const isZh = (data.lang || "").toLowerCase().startsWith("zh");

  const networkOverheadMs =
    typeof clientApiMs === "number" ? Math.max(0, Math.round(clientApiMs - data.timing.totalMs)) : null;
  const edgeEndToEndMs = typeof clientApiMs === "number" ? clientApiMs : data.timing.totalMs;

  // Multi-level cache display (kv.txt): memory / KV / realtime generate.
  const cacheLayerLabel = (() => {
    const layer = data.cache.layer ?? (data.cache.hit ? "unknown" : "generate");
    const ms =
      typeof data.cache.layerMs === "number" && Number.isFinite(data.cache.layerMs)
        ? `${Math.max(0, Math.round(data.cache.layerMs))}ms`
        : null;

    if (isZh) {
      if (data.cache.hit && layer === "memory") return `内存命中${ms ? ` (${ms})` : ""}`;
      if (data.cache.hit && layer === "kv") return `KV命中${ms ? ` (${ms})` : ""}`;
      if (!data.cache.hit) return `实时生成${ms ? ` (${ms})` : ""}`;
      return `命中${ms ? ` (${ms})` : ""}`;
    }

    if (data.cache.hit && layer === "memory") return `memory hit${ms ? ` (${ms})` : ""}`;
    if (data.cache.hit && layer === "kv") return `KV hit${ms ? ` (${ms})` : ""}`;
    if (!data.cache.hit) return `generated live${ms ? ` (${ms})` : ""}`;
    return `hit${ms ? ` (${ms})` : ""}`;
  })();

  const popLine = (() => {
    const name = data.edge.pop?.city;
    if (!name) return null;
    const km = data.edge.pop?.distanceKm;
    if (typeof km === "number" && Number.isFinite(km)) return isZh ? `${name} · 约${Math.round(km)}km` : `${name} · ~${Math.round(km)}km`;
    return name;
  })();

  const uidShort = (() => {
    const uid = techState?.uid;
    if (!uid) return null;
    if (uid.length <= 12) return uid;
    return `${uid.slice(0, 6)}…${uid.slice(-4)}`;
  })();

  const syncLabel = (v: "edge" | "local") => (v === "edge" ? "EdgeKV" : isZh ? "本地" : "local");

  const statBars = useMemo(() => {
    if (!data.stats) return null;
    const max = Math.max(1, data.stats.todayGlobal, data.stats.todayCity, data.stats.todayMode ?? 0);
    return {
      globalW: Math.max(8, Math.round((data.stats.todayGlobal / max) * 100)),
      cityW: Math.max(8, Math.round((data.stats.todayCity / max) * 100)),
      modeW: data.stats.todayMode ? Math.max(8, Math.round((data.stats.todayMode / max) * 100)) : 0
    };
  }, [data.stats]);

  return (
    <motion.aside
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.98 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="fixed bottom-5 right-5 z-50 w-[min(92vw,420px)] overflow-hidden rounded-3xl border border-black/10 bg-white/70 shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur dark:border-white/12 dark:bg-black/40 dark:shadow-glow"
      aria-label="debug panel"
    >
      <div className="flex items-center justify-between gap-3 border-b border-black/10 px-5 py-4 dark:border-white/10">
        <div className="space-y-0.5">
          <div className="text-xs tracking-widest text-black/60 dark:text-white/60">DEBUG</div>
          <div className="text-sm font-semibold text-black/90 dark:text-white/90">显示技术细节</div>
        </div>
        <button
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-white/70 text-black/70 transition hover:bg-white dark:border-white/15 dark:bg-black/30 dark:text-white/80 dark:hover:bg-black/45"
          onClick={onClose}
          aria-label="Close"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="space-y-4 px-5 py-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-black/10 bg-white/70 p-3 dark:border-white/10 dark:bg-black/30">
            <div className="text-[11px] text-black/60 dark:text-white/60">{t("result.cache")}</div>
            <div className="mt-1 text-sm font-semibold text-black/90 dark:text-white/90">
              {cacheLayerLabel}
            </div>
            <div className="mt-1 text-[11px] text-black/55 dark:text-white/55">
              TTL {t("result.ttlValue", { minutes: Math.round(data.cache.ttlMs / 60000) })}
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 bg-white/70 p-3 dark:border-white/10 dark:bg-black/30">
            <div className="text-[11px] text-black/60 dark:text-white/60">EDGE</div>
            <div className="mt-1 text-sm font-semibold text-black/90 dark:text-white/90">{data.edge.node}</div>
            <div className="mt-1 text-[11px] text-black/55 dark:text-white/55">
              {data.edge.provider}
              {popLine ? ` · ${popLine}` : ""}
            </div>
          </div>
        </div>

        {techState ? (
          <div className="rounded-2xl border border-black/10 bg-white/70 p-4 dark:border-white/10 dark:bg-black/30">
            <div className="text-xs text-black/60 dark:text-white/60">User state</div>
            <div className="mt-1 text-sm font-semibold text-black/90 dark:text-white/90">
              UID {uidShort ?? "N/A"}
            </div>
            <div className="mt-1 text-[11px] text-black/55 dark:text-white/55">
              Quests: {syncLabel(techState.daily.sync)} · History: {syncLabel(techState.history.sync)} ({techState.history.size})
            </div>
          </div>
        ) : null}

        <PerformanceComparison
          edgeMs={edgeEndToEndMs}
          originSimulatedMs={data.timing.originSimulatedMs}
          cacheHit={data.cache.hit}
          cacheLayer={data.cache.layer}
        />

        <div className="rounded-2xl border border-black/10 bg-white/70 p-4 dark:border-white/10 dark:bg-black/30">
          <div className="text-xs text-black/60 dark:text-white/60">Timing</div>
          <div className="mt-1 text-sm text-black/90 dark:text-white/90">
            {t("result.metrics", {
              total: data.timing.totalMs,
              geo: data.timing.geoMs,
              weather: data.timing.weatherMs,
              ai: data.timing.aiMs
            })}
          </div>
          {typeof clientApiMs === "number" ? (
            <div className="mt-1 text-[11px] text-black/55 dark:text-white/55">
              {t("result.apiRoundTrip", { ms: clientApiMs })}
              {networkOverheadMs != null ? ` · ${t("result.netOverhead", { ms: networkOverheadMs })}` : ""}
            </div>
          ) : null}
        </div>

        {data.stats && statBars ? (
          <div className="rounded-2xl border border-black/10 bg-white/70 p-4 dark:border-white/10 dark:bg-black/30">
            <div className="mb-1 flex items-center justify-between">
              <div className="text-xs text-black/60 dark:text-white/60">{t("stats.title")}</div>
              {data.stats.source === "edgekv" && (
                <div className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[9px] font-medium text-emerald-700 dark:text-emerald-400">
                  EdgeKV
                </div>
              )}
            </div>
            <div className="mt-3 space-y-2">
              <div>
                <div className="mb-1 text-[11px] text-black/65 dark:text-white/65">
                  {t("stats.global", { count: data.stats.todayGlobal })}
                </div>
                <div className="h-2 rounded-full bg-black/10 dark:bg-white/10">
                  <div className="h-2 rounded-full bg-[#34d399]" style={{ width: `${statBars.globalW}%` }} />
                </div>
              </div>
              <div>
                <div className="mb-1 text-[11px] text-black/65 dark:text-white/65">
                  {t("stats.city", { city: data.location.city ?? t("common.unknown"), count: data.stats.todayCity })}
                </div>
                <div className="h-2 rounded-full bg-black/10 dark:bg-white/10">
                  <div className="h-2 rounded-full bg-[#a78bfa]" style={{ width: `${statBars.cityW}%` }} />
                </div>
              </div>
              {data.stats.todayMode != null && statBars.modeW > 0 && (
                <div>
                  <div className="mb-1 text-[11px] text-black/65 dark:text-white/65">
                    {t("stats.mode", { mode: data.mode, count: data.stats.todayMode })}
                  </div>
                  <div className="h-2 rounded-full bg-black/10 dark:bg-white/10">
                    <div className="h-2 rounded-full bg-[#60a5fa]" style={{ width: `${statBars.modeW}%` }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </motion.aside>
  );
}
