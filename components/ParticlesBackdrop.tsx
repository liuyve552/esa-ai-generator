export default function ParticlesBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {/* Primary aura (weather-linked via CSS vars set by Oracle output) */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgb(var(--esa-weather-aura-1)/0.20),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgb(var(--esa-weather-aura-2)/0.14),transparent_58%)]" />

      {/* Deep purple to black base */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_0%,#2E1065,transparent_55%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.12),rgba(0,0,0,0.70),rgba(0,0,0,0.92))]" />
    </div>
  );
}
