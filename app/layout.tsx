import "./globals.css";
import "leaflet/dist/leaflet.css";

import type { Metadata, Viewport } from "next";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "全球边缘神谕｜ESA Pages",
  description: "在阿里云 ESA 边缘节点上：定位 → 天气 → AI/模板 → 缓存 → 分享海报，让「就近计算」变得可感知、可传播。",
  manifest: "/manifest.webmanifest",
  keywords: ["边缘计算", "ESA", "阿里云", "AI生成", "天气预报", "位置服务", "边缘函数", "EdgeKV"],
  authors: [{ name: "ESA AI Generator Team" }],
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: "https://esa-ai-generator.7d7df28e.er.aliyun-esa.net",
    siteName: "全球边缘神谕",
    title: "全球边缘神谕｜ESA Pages - 让边缘计算可感知",
    description: "基于阿里云 ESA 边缘节点的 AI 神谕应用：定位 → 天气 → AI/模板生成 → 多级缓存 → 分享海报，全链路边缘化，让「就近计算」变得可感知、可传播。",
    images: [
      {
        url: "https://esa-ai-generator.7d7df28e.er.aliyun-esa.net/esa-pages-banner.png",
        width: 1200,
        height: 630,
        alt: "全球边缘神谕 - ESA 边缘计算演示"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "全球边缘神谕｜ESA Pages",
    description: "基于阿里云 ESA 的边缘计算应用：AI 生成 + 多级缓存 + 实时天气 + 全球 POP",
    images: ["https://esa-ai-generator.7d7df28e.er.aliyun-esa.net/esa-pages-banner.png"]
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true
    }
  }
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
