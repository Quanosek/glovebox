import type { NextConfig } from "next";

const CASCADA = "/auto/opel-cascada-2016";

const nextConfig: NextConfig = {
  // Local Node.js server (`next dev` / `next start`): the import wizard
  // writes new cars into `database/`, which a static export cannot do.
  images: { unoptimized: true },
  async redirects() {
    // URLs of the first, single-car version of the app. The Cascada-only
    // equipment page became `/auto/<car>/wyposazenie` for every car.
    const old = ["instrukcja", "navi-950"].flatMap((route) => [
      {
        source: `/${route}`,
        destination: `${CASCADA}/${route}`,
        permanent: true,
      },
      {
        source: `/${route}/:path*`,
        destination: `${CASCADA}/${route}/:path*`,
        permanent: true,
      },
    ]);
    return [
      ...old,
      { source: "/twoje-auto", destination: "/auta", permanent: true },
    ];
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
