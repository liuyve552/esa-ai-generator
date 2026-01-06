import "./globals.css";
import "leaflet/dist/leaflet.css";

import type { Metadata, Viewport } from "next";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "Global Edge AI Personalizer",
  description:
    "Edge Runtime + Geo + Weather + AI + Caching: generate localized stories/advice with ultra-low-latency demos.",
  manifest: "/manifest.webmanifest"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
