"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import ResultView from "@/components/ResultView";
import type { GenerateResponse } from "@/lib/edge/types";

export default function SharePageClient() {
  const sp = useSearchParams();
  const id = useMemo(() => (sp.get("id") ?? "").trim(), [sp]);
  const d = useMemo(() => (sp.get("d") ?? "").trim(), [sp]);

  const [data, setData] = useState<GenerateResponse | null>(null);
  const [clientApiMs, setClientApiMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setClientApiMs(null);
    setError(null);

    if (!id && !d) return;

    const ac = new AbortController();

    const incView = (shareId: string) =>
      fetch(`/api/view/${encodeURIComponent(shareId)}`, {
        method: "POST",
        cache: "no-store",
        signal: ac.signal
      }).catch(() => null);

    const load = async () => {
      const t0 = performance.now();

      if (id) {
        void incView(id);

        const qs = new URLSearchParams();
        qs.set("id", id);
        if (d) qs.set("d", d);

        const res = await fetch(`/api/share?${qs.toString()}`, { cache: "no-store", signal: ac.signal });
        if (res.ok) {
          const json = (await res.json()) as GenerateResponse;
          setClientApiMs(Math.round(performance.now() - t0));
          setData(json);
          return;
        }

        if (res.status !== 404 || !d) {
          throw new Error(await res.text());
        }
      }

      // Fallback: replay from embedded share snapshot.
      if (!d) throw new Error("Missing embedded share payload");

      const res = await fetch(`/api/replay?d=${encodeURIComponent(d)}`, { cache: "no-store", signal: ac.signal });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as GenerateResponse;

      if (json.share?.id) void incView(json.share.id);

      setClientApiMs(Math.round(performance.now() - t0));
      setData(json);
    };

    void load().catch((e) => {
      if (ac.signal.aborted) return;
      setError(e instanceof Error ? e.message : String(e));
    });

    return () => ac.abort();
  }, [id, d]);

  if (!id && !d) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-glow">
        <h2 className="text-lg font-semibold">Missing share id</h2>
        <p className="mt-2 text-sm text-white/70">This link should look like /s/?id=YOUR_ID</p>
        <a className="mt-4 inline-flex rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black" href="/">
          Back to home
        </a>
      </div>
    );
  }

  return (
    <>
      {error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-100">{error}</div>
      ) : null}
      {data ? <ResultView data={data} sharedId={id || data.share?.id || undefined} clientApiMs={clientApiMs ?? undefined} /> : null}
    </>
  );
}
