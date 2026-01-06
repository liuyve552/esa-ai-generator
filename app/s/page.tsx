import { Suspense } from "react";
import ParticlesBackdrop from "@/components/ParticlesBackdrop";
import SharePageClient from "@/components/SharePageClient";

function LoadingCard() {
  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_20px_60px_rgba(0,0,0,0.12)] dark:border-white/10 dark:bg-white/5 dark:shadow-glow">
      <div className="h-5 w-40 animate-pulse rounded bg-black/10 dark:bg-white/10" />
      <div className="mt-4 space-y-2">
        <div className="h-4 w-full animate-pulse rounded bg-black/10 dark:bg-white/10" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-black/10 dark:bg-white/10" />
        <div className="h-4 w-4/6 animate-pulse rounded bg-black/10 dark:bg-white/10" />
      </div>
    </div>
  );
}

export default function SharePage() {
  return (
    <main className="relative min-h-[100dvh] overflow-hidden">
      <ParticlesBackdrop />
      <div className="mx-auto w-full max-w-6xl px-6 py-8 md:py-10">
        <Suspense fallback={<LoadingCard />}>
          <SharePageClient />
        </Suspense>
      </div>
    </main>
  );
}


