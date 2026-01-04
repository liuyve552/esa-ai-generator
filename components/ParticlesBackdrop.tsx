export default function ParticlesBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute -left-24 -top-24 h-[420px] w-[420px] rounded-full bg-fuchsia-600/30 blur-[80px]" />
      <div className="absolute -bottom-24 -right-24 h-[420px] w-[420px] rounded-full bg-emerald-500/25 blur-[90px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(255,255,255,0.12),transparent_55%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.25),rgba(0,0,0,0.85))]" />
    </div>
  );
}

