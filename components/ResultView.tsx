"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import type { GenerateResponse } from "@/lib/edge/types";
import LatencyChart from "@/components/LatencyChart";

const WorldMap = dynamic(() => import("@/components/WorldMap"), { ssr: false });

function formatTemp(t: number | null | undefined) {
  if (typeof t !== "number" || Number.isNaN(t)) return "N/A";
  return `${Math.round(t)}°C`;
}

export default function ResultView({
  data,
  sharedId,
  clientApiMs
}: {
  data: GenerateResponse;
  sharedId?: string;
  clientApiMs?: number;
}) {
  const [copied, setCopied] = useState(false);

  const shareUrl = useMemo(() => {
    const origin = globalThis.location?.origin ?? "";
    const fromApi = data.share?.url;
    if (fromApi) return `${origin}${fromApi}`;
    const id = sharedId ?? data.share?.id;
    if (!id) return null;
    return `${origin}/s/?id=${id}`;
  }, [data.share?.id, data.share?.url, sharedId]);

  const networkOverheadMs =
    typeof clientApiMs === "number" ? Math.max(0, Math.round(clientApiMs - data.timing.totalMs)) : null;

  const edgeEndToEndMs = typeof clientApiMs === "number" ? clientApiMs : data.timing.totalMs;

  return (
    <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative overflow-hidden rounded-3xl border border-black/10 bg-white/70 p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_20px_60px_rgba(0,0,0,0.12)] dark:border-white/10 dark:bg-white/5 dark:p-6 dark:shadow-glow"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-xs tracking-widest text-black/60 dark:text-white/60">EDGE RESULT</div>
            <h2 className="text-lg font-semibold md:text-xl">
              {data.location.city ? `${data.location.city}, ` : ""}
              {data.location.country ?? "Unknown"} · {formatTemp(data.weather.temperatureC)} · {data.weather.description}
            </h2>
            <p className="text-xs text-black/60 dark:text-white/60">
              {data.edge.provider} · {data.edge.node} · cache {data.cache.hit ? "hit" : "miss"} · ttl{" "}
              {Math.round(data.cache.ttlMs / 60000)}m · geo {data.location.source}
            </p>
            <p className="text-xs text-black/60 dark:text-white/60">
              Edge compute {data.timing.totalMs}ms (geo {data.timing.geoMs}ms · weather {data.timing.weatherMs}ms · ai{" "}
              {data.timing.aiMs}ms)
              {typeof clientApiMs === "number" ? ` · API round-trip ${clientApiMs}ms` : ""}
              {networkOverheadMs != null ? ` · net/overhead ~${networkOverheadMs}ms` : ""}
            </p>
            <p className="text-[11px] text-black/50 dark:text-white/45">
              Tip: repeat the same prompt within 5–10 minutes to see cache hits and much lower end-to-end latency.
            </p>
          </div>

          {shareUrl ? (
            <div className="flex items-center gap-2">
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
                {copied ? "Copied" : "Copy share link"}
              </button>
            </div>
          ) : null}
        </div>

        <div className="mt-5 rounded-2xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-black/30">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-black/90 dark:text-white/90">{data.content.text}</p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-black/30">
            <div className="text-xs text-black/60 dark:text-white/60">Prompt</div>
            <div className="mt-1 text-sm text-black/90 dark:text-white/90">{data.prompt}</div>
          </div>
          <div className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-black/30">
            <div className="text-xs text-black/60 dark:text-white/60">AI</div>
            <div className="mt-1 text-sm text-black/90 dark:text-white/90">
              {data.content.model} · {data.content.mode}
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
            <div className="text-xs text-black/60 dark:text-white/60">Edge cache (5–10 min)</div>
            <div className="mt-1 text-sm text-black/90 dark:text-white/90">Keyed by prompt+lang+location. Hit reduces weather/AI calls.</div>
          </div>

          <div className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-black/30">
            <div className="text-xs text-black/60 dark:text-white/60">Share / View count demo</div>
            <div className="mt-1 text-sm text-black/90 dark:text-white/90">
              {data.share?.views != null ? `Views: ${data.share.views}` : "Views: N/A"}
            </div>
            <div className="mt-1 text-[11px] text-black/50 dark:text-white/45">
              Share links embed a snapshot (so the page stays available). KV improves view-count stability.
            </div>
          </div>
        </div>
      </motion.aside>
    </div>
  );
}
