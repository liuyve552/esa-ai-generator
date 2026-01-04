import { Suspense } from "react";
import { headers } from "next/headers";
import ResultView from "@/components/ResultView";
import type { GenerateResponse } from "@/lib/edge/types";
import ParticlesBackdrop from "@/components/ParticlesBackdrop";

export const runtime = "edge";
export const dynamic = "force-dynamic";

function getBaseUrl(h: Headers) {
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return "http://localhost:3000";
  return `${proto}://${host}`;
}

async function ResultLoader({
  prompt,
  lang
}: {
  prompt: string;
  lang: string;
}): Promise<React.ReactElement> {
  const baseUrl = getBaseUrl(headers());
  const url = new URL("/api/generate", baseUrl);
  url.searchParams.set("prompt", prompt);
  url.searchParams.set("lang", lang);

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Generate failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as GenerateResponse;
  return <ResultView data={data} />;
}

export default function ResultPage({
  searchParams
}: {
  searchParams: { prompt?: string; lang?: string };
}) {
  const prompt = (searchParams.prompt ?? "").trim();
  const lang = (searchParams.lang ?? "en").trim() || "en";

  if (!prompt) {
    return (
      <main className="relative min-h-screen overflow-hidden">
        <ParticlesBackdrop />
        <div className="mx-auto w-full max-w-4xl px-6 py-10">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
            <h2 className="text-lg font-semibold">Missing prompt</h2>
            <p className="mt-2 text-sm text-white/70">Go back to the home page and enter a prompt to generate.</p>
            <a className="mt-4 inline-flex rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black" href="/">
              Back to home
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <ParticlesBackdrop />
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <Suspense
          fallback={
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-glow">
              <div className="h-5 w-40 animate-pulse rounded bg-white/10" />
              <div className="mt-4 space-y-2">
                <div className="h-4 w-full animate-pulse rounded bg-white/10" />
                <div className="h-4 w-5/6 animate-pulse rounded bg-white/10" />
                <div className="h-4 w-4/6 animate-pulse rounded bg-white/10" />
              </div>
            </div>
          }
        >
          <ResultLoader prompt={prompt} lang={lang} />
        </Suspense>
      </div>
    </main>
  );
}
