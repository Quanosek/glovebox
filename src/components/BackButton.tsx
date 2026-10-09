"use client";

import { usePathname, useRouter } from "next/navigation";
import { isValidId } from "@/lib/slug";

const PRIMARY_PATHS = new Set([
  "/",
  "/auta",
  "/notatnik",
  "/komentarze",
  "/zakladki",
  "/ustawienia",
  "/dodaj-auto",
]);

export function BackButton() {
  const pathname = usePathname();
  const router = useRouter();
  const isCarHome = /^\/auto\/[^/]+$/.test(pathname);

  if (PRIMARY_PATHS.has(pathname) || isCarHome) return null;

  const carId = /^\/auto\/([^/]+)/.exec(pathname)?.[1];
  const bookRoute = /^\/auto\/[^/]+\/([^/]+)/.exec(pathname)?.[1];
  const fallback = carId
    ? bookRoute === "wyposazenie"
      ? "/"
      : bookRoute
        ? `/auto/${carId}/${bookRoute}`
        : `/auto/${carId}`
    : "/";

  return (
    <div className="back-navigation print:hidden">
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => {
          const selectedCar = new URLSearchParams(window.location.search).get(
            "car",
          );
          const target = isValidId(selectedCar)
            ? `/auto/${selectedCar}`
            : fallback;
          const referrer = document.referrer;
          if (
            window.history.length > 1 &&
            referrer.startsWith(window.location.origin)
          )
            router.back();
          else router.push(target);
        }}
      >
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
        Wstecz
      </button>
    </div>
  );
}
