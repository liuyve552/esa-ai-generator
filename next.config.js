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

