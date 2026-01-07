import HomeForm from "@/components/HomeForm";
import HomeAutoDemo from "@/components/HomeAutoDemo";
import ParticlesBackdrop from "@/components/ParticlesBackdrop";
import ThemeToggle from "@/components/ThemeToggle";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <ParticlesBackdrop />

      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-10">
        <header className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs tracking-widest text-black/60 dark:text-white/60">ESA PAGES · EDGE</p>
            <h1 className="text-balance text-2xl font-semibold leading-tight md:text-3xl">全球边缘神谕</h1>
            <p className="text-sm text-black/65 dark:text-white/60">
              把“就近计算”做成可传播的体验：定位 → 天气 → 生成 → 缓存 → 分享海报
            </p>
          </div>
          <ThemeToggle />
        </header>

        <section className="mt-8">
          <HomeForm />
          <HomeAutoDemo />
        </section>

        <footer className="mt-10 text-xs text-black/55 dark:text-white/50">
          Edge-only pipeline: Geo → Weather → AI/Template → Cache → Share (5–10 min)
        </footer>
      </div>
    </main>
  );
}

