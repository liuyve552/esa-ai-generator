"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import type { GenerateResponse } from "@/lib/edge/types";
import LatencyChart from "@/components/LatencyChart";

const WorldMap = dynamic(() => import("@/components/WorldMap"), { ssr: false });

function formatTemp(t: number | null | undefined) {
  if (typeof t !== "number" || Number.isNaN(t)) return "—";
  return `${Math.round(t)}°C`;
}

export default function ResultView({ data, sharedId }: { data: GenerateResponse; sharedId?: string }) {
  const [copied, setCopied] = useState(false);

  const shareUrl = useMemo(() => {
    const id = sharedId ?? data.share?.id;
    if (!id) return null;
    return `${globalThis.location?.origin ?? ""}/s/${id}`;
  }, [data.share?.id, sharedId]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-xs tracking-widest text-white/60">EDGE RESULT</div>
            <h2 className="text-lg font-semibold md:text-xl">
              {data.location.city ? `${data.location.city}, ` : ""}
              {data.location.country ?? "Unknown"} · {formatTemp(data.weather.temperatureC)} · {data.weather.description}
            </h2>
            <p className="text-xs text-white/60">
              {data.edge.provider} · {data.edge.node} · {data.timing.totalMs}ms{" "}
              {data.cache.hit ? "· cache hit" : "· cache miss"} · est RTT <50ms (sim)
            </p>
          </div>

          {shareUrl ? (
            <div className="flex items-center gap-2">
              <button
                className="h-9 rounded-xl border border-white/15 bg-black/30 px-3 text-xs text-white/85 hover:bg-black/45"
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
                {copied ? "Copied" : "Copy share link"}
              </button>
            </div>
          ) : null}
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-5">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/90">{data.content.text}</p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs text-white/60">Prompt</div>
            <div className="mt-1 text-sm text-white/90">{data.prompt}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs text-white/60">AI</div>
            <div className="mt-1 text-sm text-white/90">
              {data.content.model} · {data.content.mode}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <LatencyChart edgeMs={data.timing.totalMs} originSimulatedMs={data.timing.originSimulatedMs} />
        </div>
      </motion.section>

      <motion.aside
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: "easeOut", delay: 0.05 }}
        className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow"
      >
        <div className="h-[360px] overflow-hidden rounded-2xl border border-white/10 bg-black/25">
          <WorldMap
            latitude={data.location.latitude ?? 0}
            longitude={data.location.longitude ?? 0}
            city={data.location.city ?? undefined}
          />
        </div>

        <div className="mt-4 grid gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs text-white/60">Edge cache (5–10min)</div>
            <div className="mt-1 text-sm text-white/90">
              Keyed by prompt+lang+location. Hit reduces weather/AI calls.
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs text-white/60">Share / View count demo</div>
            <div className="mt-1 text-sm text-white/90">
              {data.share?.views != null ? `Views: ${data.share.views}` : "Views: —"}
            </div>
          </div>
        </div>
      </motion.aside>
    </div>
  );
}
