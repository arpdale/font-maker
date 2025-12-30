import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable WASM support for esm-potrace-wasm
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    // Handle WASM files
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    });

    // Ignore Node.js modules that aren't available in browser
    // Required for PDF.js and OpenCV.js
    config.resolve.fallback = {
      ...config.resolve.fallback,
      canvas: false,
      fs: false,
      path: false,
      crypto: false,
    };

    return config;
  },

  // Empty turbopack config to silence warning (we use webpack for WASM)
  turbopack: {},

  // Optimize for production
  reactStrictMode: true,

  // Enable static exports for Vercel
  output: 'export',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
