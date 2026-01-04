"use client";

export default function LatencyChart({
  edgeMs,
  originSimulatedMs
}: {
  edgeMs: number;
  originSimulatedMs: number;
}) {
  const max = Math.max(edgeMs, originSimulatedMs, 1);
  const edgeW = Math.max(6, Math.round((edgeMs / max) * 100));
  const originW = Math.max(6, Math.round((originSimulatedMs / max) * 100));

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-white/60">Latency comparison</div>
        <div className="text-xs text-white/60">
          Edge {edgeMs}ms · Origin {originSimulatedMs}ms
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <div>
          <div className="mb-1 text-[11px] text-white/70">Edge (end-to-end)</div>
          <div className="h-3 rounded-full bg-white/10">
            <div className="h-3 rounded-full bg-emerald-400/90" style={{ width: `${edgeW}%` }} />
          </div>
        </div>
        <div>
          <div className="mb-1 text-[11px] text-white/70">Central server (simulated baseline)</div>
          <div className="h-3 rounded-full bg-white/10">
            <div className="h-3 rounded-full bg-fuchsia-400/90" style={{ width: `${originW}%` }} />
          </div>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-white/55">
        Origin is a demo baseline to help visualize the benefit of caching and edge execution.
      </p>
    </div>
  );
}
