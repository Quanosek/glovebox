import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.GLOVEBOX_STANDALONE === "1" ? "standalone" : undefined,
  outputFileTracingExcludes: {
    "/*": ["./database/**/*", "./.venv/**/*", "./.runtime/**/*"],
  },
  experimental: {
    cpus: 1,
    preloadEntriesOnStart: false,
  },
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
