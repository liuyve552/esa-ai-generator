"use client";

import { useTranslation } from "react-i18next";

interface PerformanceComparisonProps {
  edgeMs: number;
  originSimulatedMs: number;
  cacheHit: boolean;
  cacheLayer?: string;
}

export default function PerformanceComparison({
  edgeMs,
  originSimulatedMs,
  cacheHit,
  cacheLayer
}: PerformanceComparisonProps) {
  const { t } = useTranslation();

  const savedMs = originSimulatedMs - edgeMs;
  const savedPercent = originSimulatedMs > 0 ? Math.round((savedMs / originSimulatedMs) * 100) : 0;

  const max = Math.max(edgeMs, originSimulatedMs, 1);
  const edgeW = Math.max(6, Math.round((edgeMs / max) * 100));
  const originW = Math.max(6, Math.round((originSimulatedMs / max) * 100));

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-black/30">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium text-black/80 dark:text-white/80">
            {t("performance.title", "性能对比")}
          </div>
          {cacheHit && (
            <div className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
              {t("performance.cached", "已缓存")}
            </div>
          )}
        </div>
        <div className="text-xs text-black/60 dark:text-white/60">
          {t("performance.subtitle", "边缘 vs 中心化")}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-black/5 p-3 dark:bg-white/5">
          <div className="text-[10px] text-black/60 dark:text-white/60">
            {t("performance.edgeLatency", "边缘延迟")}
          </div>
          <div className="mt-1 text-lg font-semibold text-emerald-600 dark:text-emerald-400">
            {edgeMs}ms
          </div>
          {cacheLayer && (
            <div className="mt-1 text-[9px] text-black/50 dark:text-white/50">
              {cacheLayer === "memory"
                ? t("performance.l1Memory", "L1 内存")
                : cacheLayer === "kv"
                  ? t("performance.l2Kv", "L2 EdgeKV")
                  : t("performance.l3Generate", "L3 生成")}
            </div>
          )}
        </div>

        <div className="rounded-xl bg-black/5 p-3 dark:bg-white/5">
          <div className="text-[10px] text-black/60 dark:text-white/60">
            {t("performance.centerLatency", "中心延迟")}
          </div>
          <div className="mt-1 text-lg font-semibold text-fuchsia-600 dark:text-fuchsia-400">
            {originSimulatedMs}ms
          </div>
          <div className="mt-1 text-[9px] text-black/50 dark:text-white/50">
            {t("performance.simulated", "模拟值")}
          </div>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-cyan-50 p-3 dark:from-emerald-950/30 dark:to-cyan-950/30">
          <div className="text-[10px] text-black/60 dark:text-white/60">
            {t("performance.timeSaved", "节省时间")}
          </div>
          <div className="mt-1 text-lg font-semibold text-cyan-700 dark:text-cyan-400">
            {savedMs}ms
          </div>
          <div className="mt-1 text-[9px] font-medium text-cyan-600 dark:text-cyan-500">
            ↓ {savedPercent}%
          </div>
        </div>
      </div>

      {/* Visual Comparison Bars */}
      <div className="space-y-3">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <div className="text-[11px] font-medium text-black/70 dark:text-white/70">
              {t("performance.edgeCompute", "边缘计算")}
            </div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400">
              {edgeMs}ms
            </div>
          </div>
          <div className="h-4 rounded-full bg-black/10 dark:bg-white/10">
            <div
              className="flex h-4 items-center justify-end rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 pr-2 transition-all duration-500"
              style={{ width: `${edgeW}%` }}
            >
              {edgeW > 20 && (
                <span className="text-[9px] font-bold text-white drop-shadow">
                  {edgeMs}ms
                </span>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <div className="text-[11px] font-medium text-black/70 dark:text-white/70">
              {t("performance.centerCompute", "中心化计算")}
            </div>
            <div className="text-[10px] text-fuchsia-600 dark:text-fuchsia-400">
              {originSimulatedMs}ms
            </div>
          </div>
          <div className="h-4 rounded-full bg-black/10 dark:bg-white/10">
            <div
              className="flex h-4 items-center justify-end rounded-full bg-gradient-to-r from-fuchsia-400 to-pink-500 pr-2 transition-all duration-500"
              style={{ width: `${originW}%` }}
            >
              {originW > 20 && (
                <span className="text-[9px] font-bold text-white drop-shadow">
                  {originSimulatedMs}ms
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Explanation Note */}
      <div className="mt-4 rounded-lg bg-black/5 p-3 dark:bg-white/5">
        <p className="text-[11px] leading-relaxed text-black/60 dark:text-white/60">
          <span className="font-medium text-emerald-600 dark:text-emerald-400">
            {t("performance.advantage", "边缘优势：")}
          </span>{" "}
          {t(
            "performance.explanation",
            "内容在全球边缘节点生成并缓存，用户请求就近计算响应，避免了到中心机房的长距离网络往返。"
          )}
        </p>
      </div>

      {/* Cost Savings (optional) */}
      {cacheHit && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200/50 bg-emerald-50/50 p-2 dark:border-emerald-800/50 dark:bg-emerald-950/30">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/20">
            <svg
              className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <p className="flex-1 text-[10px] text-emerald-700 dark:text-emerald-400">
            {t(
              "performance.costSaving",
              "缓存命中节省了 AI 计算成本，EdgeKV 实现全球数据同步"
            )}
          </p>
        </div>
      )}
    </div>
  );
}
