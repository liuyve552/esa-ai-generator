"use client";

import { useTranslation } from "react-i18next";

interface CacheMetrics {
  layer: string;
  hit: boolean;
  layerMs: number | null;
  ttlMs: number;
}

interface CacheHitDashboardProps {
  cache: CacheMetrics;
}

export default function CacheHitDashboard({ cache }: CacheHitDashboardProps) {
  const { t } = useTranslation();

  const layers = [
    { key: "memory", label: "L1 内存", color: "emerald", desc: "~0ms" },
    { key: "kv", label: "L2 EdgeKV", color: "blue", desc: "~5-20ms" },
    { key: "generate", label: "L3 生成", color: "amber", desc: "~500-2000ms" }
  ];

  const currentLayer = cache.layer || (cache.hit ? "unknown" : "generate");
  const layerMs = typeof cache.layerMs === "number" ? Math.max(0, Math.round(cache.layerMs)) : null;

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-black/30">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm font-medium text-black/80 dark:text-white/80">
          {t("cache.dashboard", "多级缓存架构")}
        </div>
        {cache.hit && (
          <div className="rounded-full bg-emerald-400/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            {t("cache.hit", "命中")}
          </div>
        )}
      </div>

      {/* Cache Layers Visualization */}
      <div className="space-y-3">
        {layers.map((layer, idx) => {
          const isActive = currentLayer === layer.key;
          const isHit = isActive && cache.hit;

          return (
            <div
              key={layer.key}
              className={`relative rounded-xl border p-3 transition-all ${
                isActive
                  ? "border-emerald-400/50 bg-emerald-50/50 dark:border-emerald-600/50 dark:bg-emerald-950/30"
                  : "border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {/* Status Indicator */}
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full ${
                      isHit
                        ? "bg-emerald-400/30 dark:bg-emerald-500/30"
                        : isActive
                          ? "bg-amber-400/30 dark:bg-amber-500/30"
                          : "bg-black/10 dark:bg-white/10"
                    }`}
                  >
                    {isHit ? (
                      <svg
                        className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : isActive ? (
                      <svg
                        className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-black/20 dark:bg-white/20" />
                    )}
                  </div>

                  {/* Layer Info */}
                  <div>
                    <div
                      className={`text-xs font-semibold ${
                        isActive ? "text-black/90 dark:text-white/90" : "text-black/60 dark:text-white/60"
                      }`}
                    >
                      {layer.label}
                    </div>
                    <div className="text-[10px] text-black/50 dark:text-white/50">{layer.desc}</div>
                  </div>
                </div>

                {/* Timing */}
                {isActive && layerMs != null && (
                  <div className="text-right">
                    <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      {layerMs}ms
                    </div>
                  </div>
                )}
              </div>

              {/* Active Layer Highlight Bar */}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-400 to-cyan-400" />
              )}
            </div>
          );
        })}
      </div>

      {/* TTL Info */}
      <div className="mt-4 rounded-lg bg-black/5 p-3 dark:bg-white/5">
        <div className="flex items-center justify-between">
          <div className="text-[10px] text-black/60 dark:text-white/60">
            {t("cache.ttl", "缓存有效期")}
          </div>
          <div className="text-xs font-semibold text-black/80 dark:text-white/80">
            {Math.round(cache.ttlMs / 60000)} {t("cache.minutes", "分钟")}
          </div>
        </div>
      </div>

      {/* Explanation */}
      <div className="mt-4 text-[10px] leading-relaxed text-black/55 dark:text-white/55">
        {cache.hit ? (
          <>
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              {t("cache.hitExplain", "缓存命中：")}
            </span>{" "}
            {currentLayer === "memory"
              ? t(
                  "cache.memoryHit",
                  "数据在内存中命中，零网络延迟，亚毫秒级响应。"
                )
              : currentLayer === "kv"
                ? t(
                    "cache.kvHit",
                    "数据从 EdgeKV 读取，全球分布式存储，自动同步到最近节点。"
                  )
                : t("cache.otherHit", "数据已缓存，避免重复计算。")}
          </>
        ) : (
          <>
            <span className="font-medium text-amber-600 dark:text-amber-400">
              {t("cache.miss", "缓存未命中：")}
            </span>{" "}
            {t(
              "cache.missExplain",
              "首次请求实时生成，结果将缓存到多级存储，后续请求极速响应。"
            )}
          </>
        )}
      </div>

      {/* Architecture Diagram (optional) */}
      <div className="mt-4 flex items-center justify-center gap-2 text-[9px] text-black/40 dark:text-white/40">
        <span>User</span>
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span>Edge</span>
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span>EdgeKV</span>
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span>Origin</span>
      </div>
    </div>
  );
}
