export default function ParticlesBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute -left-24 -top-24 h-[440px] w-[440px] rounded-full bg-fuchsia-500/20 blur-[90px] dark:bg-fuchsia-600/30" />
      <div className="absolute -bottom-24 -right-24 h-[460px] w-[460px] rounded-full bg-emerald-400/16 blur-[110px] dark:bg-emerald-500/25" />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(0,0,0,0.10),transparent_55%)] dark:bg-[radial-gradient(circle_at_50%_10%,rgba(255,255,255,0.12),transparent_55%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.0),rgba(255,255,255,0.88))] dark:bg-[linear-gradient(to_bottom,rgba(0,0,0,0.25),rgba(0,0,0,0.85))]" />
    </div>
  );
}
