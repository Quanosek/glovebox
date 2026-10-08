import type { NextConfig } from "next";

const CASCADA = "/auto/opel-cascada-2016";

const nextConfig: NextConfig = {
  // Local Node.js server (`next dev` / `next start`): the import wizard
  // writes new cars into `database/`, which a static export cannot do.
  images: { unoptimized: true },
  async redirects() {
    // URLs of the first, single-car version of the app.
    return ["instrukcja", "navi-950"].flatMap((route) => [
      { source: `/${route}`, destination: `${CASCADA}/${route}`, permanent: true },
      {
        source: `/${route}/:path*`,
        destination: `${CASCADA}/${route}/:path*`,
        permanent: true,
      },
    ]);
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
