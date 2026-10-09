"use client";

import { usePathname, useRouter } from "next/navigation";
import { RESERVED_BOOK_ROUTES } from "@/lib/cars";
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
    ? !bookRoute || RESERVED_BOOK_ROUTES.includes(bookRoute)
      ? `/auto/${carId}`
      : `/auto/${carId}/${bookRoute}`
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

/** True for manual pages, where "Wstecz" sits on top of the table of contents. */
const isReader = (pathname: string) => {
  const route = /^\/auto\/[^/]+\/([^/]+)/.exec(pathname)?.[1];
  return route !== undefined && !RESERVED_BOOK_ROUTES.includes(route);
};

/**
 * "Wstecz". The header never changes, so the button belongs to the view:
 * `sidebar` is the first row of the manual's table of contents, `page` sits
 * above the content of other secondary screens (aligned with `.page-shell`).
 */
export function BackButton({ variant }: { variant: "sidebar" | "page" }) {
  const pathname = usePathname();
  const back = useBack();
  if (!back) return null;
  if (variant === "page" && isReader(pathname)) return null;
  return variant === "sidebar" ? (
    <button type="button" className="sidebar-back print:hidden" onClick={back}>
      <Arrow />
      Wstecz
    </button>
  ) : (
    <div className="back-navigation print:hidden">
      <button type="button" className="btn btn-ghost" onClick={back}>
        <Arrow />
        Wstecz
      </button>
    </div>
  );
}
