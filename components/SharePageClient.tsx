"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import ResultView from "@/components/ResultView";
import type { GenerateResponse } from "@/lib/edge/types";

export default function SharePageClient() {
  const sp = useSearchParams();
  const id = useMemo(() => (sp.get("id") ?? "").trim(), [sp]);

  const [data, setData] = useState<GenerateResponse | null>(null);
  const [clientApiMs, setClientApiMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setClientApiMs(null);
    setError(null);

    if (!id) return;

    const ac = new AbortController();

    fetch(`/api/view/${encodeURIComponent(id)}`, {
      method: "POST",
      cache: "no-store",
      signal: ac.signal
    }).catch(() => null);

    const t0 = performance.now();

    fetch(`/api/share/${encodeURIComponent(id)}`, { cache: "no-store", signal: ac.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return (await res.json()) as GenerateResponse;
      })
      .then((json) => {
        setClientApiMs(Math.round(performance.now() - t0));
        setData(json);
      })
      .catch((e) => {
        if (ac.signal.aborted) return;
        setError(e instanceof Error ? e.message : String(e));
      });

    return () => ac.abort();
  }, [id]);

  if (!id) {
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
      {data ? <ResultView data={data} sharedId={id} clientApiMs={clientApiMs ?? undefined} /> : null}
    </>
  );
}
