import dynamic from "next/dynamic";
import ParticlesBackdrop from "@/components/ParticlesBackdrop";

// 延迟加载 OraclePage 以减少首屏 JS
const OraclePage = dynamic(() => import("@/components/OraclePage"), {
  loading: () => (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white"></div>
        <p className="text-sm text-white/60">加载中...</p>
      </div>
    </div>
  ),
  ssr: false
});

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <ParticlesBackdrop />
      <OraclePage />
    </main>
  );
}
