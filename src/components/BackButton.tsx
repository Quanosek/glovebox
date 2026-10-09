"use client";

import { usePathname, useRouter } from "next/navigation";
import { isValidId } from "@/lib/slug";

/** Main views from the top navigation intentionally have no back button. */
const PRIMARY_PATHS = new Set([
  "/",
  "/auta",
  "/przypomnienia",
  "/notatnik",
  "/komentarze",
  "/zakladki",
  "/ustawienia",
]);

/** Back action for the current route, or null on main views. */
function useBack(): (() => void) | null {
  const pathname = usePathname();
  const router = useRouter();
  const isCarHome = /^\/auto\/[^/]+$/.test(pathname);
  if (PRIMARY_PATHS.has(pathname) || isCarHome) return null;

  const carId = /^\/auto\/([^/]+)/.exec(pathname)?.[1];
  const bookRoute = /^\/auto\/[^/]+\/([^/]+)/.exec(pathname)?.[1];
  const fallback = carId
    ? bookRoute === "wyposazenie"
      ? `/auto/${carId}`
      : bookRoute
        ? `/auto/${carId}/${bookRoute}`
        : `/auto/${carId}`
    : "/";

  return () => {
    const selectedCar = new URLSearchParams(window.location.search).get("car");
    const target = isValidId(selectedCar) ? `/auto/${selectedCar}` : fallback;
    const referrer = document.referrer;
    if (
      window.history.length > 1 &&
      referrer.startsWith(window.location.origin)
    )
      router.back();
    else router.push(target);
  };
}

const Arrow = () => (
  <svg
    viewBox="0 0 20 20"
    width="16"
    height="16"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M16 10H4m0 0 5-5m-5 5 5 5"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="square"
      strokeLinejoin="miter"
    />
  </svg>
);

/**
 * "Wstecz" at the left end of the header: a square key in the top row on
 * phones and tablets, the first entry of the navigation row on desktop.
 */
export function BackButton({ variant }: { variant: "key" | "nav" }) {
  const back = useBack();
  if (!back) return null;
  return variant === "key" ? (
    <button
      type="button"
      className="btn btn-ghost h-9 w-9 shrink-0 justify-center px-0 lg:hidden"
      aria-label="Wstecz"
      title="Wstecz"
      onClick={back}
    >
      <Arrow />
    </button>
  ) : (
    <button type="button" className="nav-back hidden lg:flex" onClick={back}>
      <Arrow />
      Wstecz
    </button>
  );
}
