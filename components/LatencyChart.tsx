"use client";

import { useTranslation } from "react-i18next";

export default function LatencyChart({
  edgeMs,
  originSimulatedMs
}: {
  edgeMs: number;
  originSimulatedMs: number;
}) {
  const { t } = useTranslation();
  const max = Math.max(edgeMs, originSimulatedMs, 1);
  const edgeW = Math.max(6, Math.round((edgeMs / max) * 100));
  const originW = Math.max(6, Math.round((originSimulatedMs / max) * 100));

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-black/30">
      <div className="flex items-center justify-between">
        <div className="text-xs text-black/60 dark:text-white/60">{t("latency.title")}</div>
        <div className="text-xs text-black/60 dark:text-white/60">
          {t("latency.edgeVsOrigin", { edge: edgeMs, origin: originSimulatedMs })}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <div>
          <div className="mb-1 text-[11px] text-black/70 dark:text-white/70">{t("latency.edgeLabel")}</div>
          <div className="h-3 rounded-full bg-black/10 dark:bg-white/10">
            <div className="h-3 rounded-full bg-emerald-400/90" style={{ width: `${edgeW}%` }} />
          </div>
        </div>
        <div>
          <div className="mb-1 text-[11px] text-black/70 dark:text-white/70">{t("latency.originLabel")}</div>
          <div className="h-3 rounded-full bg-black/10 dark:bg-white/10">
            <div className="h-3 rounded-full bg-fuchsia-400/90" style={{ width: `${originW}%` }} />
          </div>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-black/55 dark:text-white/55">{t("latency.note")}</p>
    </div>
  );
}
