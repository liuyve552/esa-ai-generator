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
  // Optimize chunking
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
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
            // Leaflet and map libraries
            leaflet: {
              name: "leaflet",
              test: /[\\/]node_modules[\\/](leaflet|react-leaflet)[\\/]/,
              chunks: "all",
              priority: 30
            },
            // i18n libraries
            i18n: {
              name: "i18n",
              test: /[\\/]node_modules[\\/](i18next|react-i18next)[\\/]/,
              chunks: "all",
              priority: 25
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

