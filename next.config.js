/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  trailingSlash: true,
  output: "export",
  images: {
    unoptimized: true,
    formats: ["image/avif", "image/webp"]
  },
  // Performance optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === "production"
  },
  // Compress output
  compress: true,
  // HTTP headers for caching and security
  async headers() {
    return [
      {
        // HTML files - short cache + must revalidate
        source: "/:path*.html",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400"
          }
        ]
      },
      {
        // Next.js static assets (with hash) - long-term cache
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        // Static resources (images, fonts, etc)
        source: "/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=2592000, s-maxage=31536000"
          }
        ]
      },
      {
        // Root path (homepage)
        source: "/",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=180, s-maxage=1800, stale-while-revalidate=3600"
          }
        ]
      },
      {
        // Security headers for all paths
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff"
          },
          {
            key: "X-Frame-Options",
            value: "DENY"
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block"
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin"
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)"
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: https: blob:; font-src 'self' data: https://unpkg.com; connect-src 'self' https://webrd01.is.autonavi.com https://webrd02.is.autonavi.com https://webrd03.is.autonavi.com https://webrd04.is.autonavi.com https://dashscope.aliyuncs.com; frame-src 'none';"
          }
        ]
      }
    ];
  },
  // Optimize chunking
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Minimize output
      config.optimization = {
        ...config.optimization,
        minimize: true,
        splitChunks: {
          chunks: "all",
          cacheGroups: {
            default: false,
            vendors: false,
            // Vendor chunk for react and react-dom
            framework: {
              name: "framework",
              chunks: "all",
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 40,
              enforce: true
            },
            // Leaflet and map libraries (only load on result page)
            leaflet: {
              name: "leaflet",
              test: /[\\/]node_modules[\\/](leaflet|react-leaflet)[\\/]/,
              chunks: "async",
              priority: 30
            },
            // i18n libraries
            i18n: {
              name: "i18n",
              test: /[\\/]node_modules[\\/](i18next|react-i18next)[\\/]/,
              chunks: "all",
              priority: 25
            },
            // Framer Motion (heavy animation library)
            motion: {
              name: "motion",
              test: /[\\/]node_modules[\\/]framer-motion[\\/]/,
              chunks: "async",
              priority: 28
            },
            // Other vendor libraries
            lib: {
              test: /[\\/]node_modules[\\/]/,
              name(module) {
                const packageName = module.context.match(
                  /[\\/]node_modules[\\/](.*?)([\\/]|$)/
                )?.[1];
                return `lib.${packageName?.replace("@", "")}`;
              },
              priority: 20
            }
          }
        }
      };
    }
    return config;
  }
};

module.exports = nextConfig;

