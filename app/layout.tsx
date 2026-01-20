import "./globals.css";
import "leaflet/dist/leaflet.css";

import type { Metadata, Viewport } from "next";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "全球边缘神谕｜ESA Pages",
  description: "在阿里云 ESA 边缘节点上：定位 → 天气 → AI/模板 → 缓存 → 分享海报，让「就近计算」变得可感知、可传播。",
  manifest: "/manifest.webmanifest"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh" className="dark" data-bg="purple" suppressHydrationWarning>
      <head>
        {/* Preconnect to critical resources */}
        <link rel="preconnect" href="https://webrd01.is.autonavi.com" />
        <link rel="preconnect" href="https://webrd02.is.autonavi.com" />
        <link rel="preconnect" href="https://webrd03.is.autonavi.com" />
        <link rel="preconnect" href="https://webrd04.is.autonavi.com" />
        <link rel="dns-prefetch" href="https://unpkg.com" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
