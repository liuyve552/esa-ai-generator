import ParticlesBackdrop from "@/components/ParticlesBackdrop";
import OraclePage from "@/components/OraclePage";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <ParticlesBackdrop />
      <OraclePage />
    </main>
  );
}
