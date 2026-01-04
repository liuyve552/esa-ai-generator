"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import ResultView from "@/components/ResultView";
import type { GenerateResponse } from "@/lib/edge/types";

export default function ResultPageClient() {
  const sp = useSearchParams();

  const prompt = useMemo(() => (sp.get("prompt") ?? "").trim(), [sp]);
  const lang = useMemo(() => (sp.get("lang") ?? "en").trim() || "en", [sp]);

  const [data, setData] = useState<GenerateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);

    if (!prompt) return;

    const url = new URL("/api/generate", globalThis.location.origin);
    url.searchParams.set("prompt", prompt);
    url.searchParams.set("lang", lang);

    const ac = new AbortController();
    fetch(url, { cache: "no-store", signal: ac.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return (await res.json()) as GenerateResponse;
      })
      .then((json) => setData(json))
      .catch((e) => {
        if (ac.signal.aborted) return;
        setError(e instanceof Error ? e.message : String(e));
      });

    return () => ac.abort();
  }, [prompt, lang]);

  if (!prompt) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
        <h2 className="text-lg font-semibold">Missing prompt</h2>
        <p className="mt-2 text-sm text-white/70">Go back to the home page and enter a prompt to generate.</p>
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
      {data ? <ResultView data={data} /> : null}
    </>
  );
}
