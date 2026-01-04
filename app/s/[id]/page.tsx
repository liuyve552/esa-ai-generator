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

async function ShareLoader({ id }: { id: string }): Promise<React.ReactElement> {
  const baseUrl = getBaseUrl(headers());

  const viewUrl = new URL(`/api/view/${encodeURIComponent(id)}`, baseUrl);
  await fetch(viewUrl, { method: "POST", cache: "no-store" }).catch(() => null);

  const url = new URL(`/api/share/${encodeURIComponent(id)}`, baseUrl);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Share load failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as GenerateResponse;
  return <ResultView data={data} sharedId={id} />;
}

export default function SharePage({ params }: { params: { id: string } }) {
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
          <ShareLoader id={params.id} />
        </Suspense>
      </div>
    </main>
  );
}
