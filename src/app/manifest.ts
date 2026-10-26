import type { MetadataRoute } from "next";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/brand";

const BACKGROUND = "#ffffff";

/** Raster icons generated from src/app/icon.svg by `pnpm icons`. */
const ICONS: MetadataRoute.Manifest["icons"] = [
  { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
  { src: "/icon-96.png", sizes: "96x96", type: "image/png", purpose: "any" },
  { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  {
    src: "/icon-maskable-192.png",
    sizes: "192x192",
    type: "image/png",
    purpose: "maskable",
  },
  {
    src: "/icon-maskable-512.png",
    sizes: "512x512",
    type: "image/png",
    purpose: "maskable",
  },
  {
    src: "/icon-monochrome-512.png",
    sizes: "512x512",
    type: "image/png",
    purpose: "monochrome",
  },
];

const SHORTCUT_ICON = [
  { src: "/icon-96.png", sizes: "96x96", type: "image/png" },
];

/**
 * Install metadata for Chromium browsers (Android, Windows, macOS, Linux,
 * ChromeOS), Firefox on Android and Safari (iOS/iPadOS 16.4+, macOS 14+,
 * which read name, display, start URL and icons; iOS also uses the Apple
 * metadata of the root layout). The app is light-only, so colours and raster
 * icons are fixed; only the SVG icon follows the system scheme.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: APP_NAME,
    short_name: APP_NAME,
    description: APP_DESCRIPTION,
    lang: "pl",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: BACKGROUND,
    theme_color: BACKGROUND,
    categories: ["books", "productivity", "utilities"],
    prefer_related_applications: false,
    // A second launch focuses the open window instead of opening another.
    launch_handler: { client_mode: ["navigate-existing", "auto"] },
    icons: ICONS,
    shortcuts: [
      {
        name: "Wybierz auto",
        short_name: "Auta",
        description: "Lista aut z instrukcjami",
        url: "/auta",
        icons: SHORTCUT_ICON,
      },
      {
        name: "Szukaj w instrukcjach",
        short_name: "Szukaj",
        url: "/szukaj",
        icons: SHORTCUT_ICON,
      },
      {
        name: "Przypomnienia",
        short_name: "Przypomnienia",
        description: "Przegląd, ubezpieczenie i własne terminy",
        url: "/przypomnienia",
        icons: SHORTCUT_ICON,
      },
      {
        name: "Notatnik",
        short_name: "Notatnik",
        url: "/notatnik",
        icons: SHORTCUT_ICON,
      },
    ],
    // Richer install dialog in Chromium (wide = desktop, narrow = phone).
    screenshots: [
      {
        src: "/screenshots/profile-wide.webp",
        sizes: "1280x800",
        type: "image/webp",
        form_factor: "wide",
        label: "Profil z autami i notatnikiem",
      },
      {
        src: "/screenshots/profile-narrow.webp",
        sizes: "412x915",
        type: "image/webp",
        form_factor: "narrow",
        label: "Profil na telefonie",
      },
    ],
  };
}
