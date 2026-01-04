import HomeForm from "@/components/HomeForm";
import ParticlesBackdrop from "@/components/ParticlesBackdrop";
import ThemeToggle from "@/components/ThemeToggle";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <ParticlesBackdrop />

      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-10">
        <header className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs tracking-widest text-white/60">ESA PAGES EDGE</p>
            <h1 className="text-balance text-2xl font-semibold leading-tight md:text-3xl">Global Edge AI Personalizer</h1>
          </div>
          <ThemeToggle />
        </header>

        <section className="mt-10 flex flex-1 flex-col justify-center">
          <HomeForm />
        </section>

        <footer className="mt-10 text-xs text-white/50">
          Edge-only pipeline: Geo → Weather → AI → Cache (5–10 min). No key? It auto-falls back to mock.
        </footer>
      </div>
    </main>
  );
}
