import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.GLOVEBOX_STANDALONE === "1" ? "standalone" : undefined,
  outputFileTracingExcludes: {
    "/*": ["./database/**/*", "./.venv/**/*", "./.runtime/**/*"],
  },
  images: { unoptimized: true },
  experimental: {
    agentUpgrade: "security",
  },
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
