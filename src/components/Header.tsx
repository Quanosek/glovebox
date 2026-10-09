"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { hasReadableManual, type CarSummary } from "@/lib/cars";
import { useOnline } from "@/lib/offline";
import { dueSoon, todayIso } from "@/lib/reminders";
import { useLayoutHint } from "@/lib/storage/hintContext";
import { useActiveCar, useAppData, useHydrated } from "@/lib/storage/hooks";
import { CarLogo } from "./CarLogo";
import { Logo } from "./Logo";

/** Current time, refreshed every 15 s; null until hydrated. */
function useClock(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 15_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/** Date and time at the right end of the navigation row, like on Navi 950. */
function Clock() {
  const now = useClock();
  const online = useOnline();
  return (
    <span className="ml-auto hidden items-center gap-3 px-3 text-sm text-graphite tabular-nums lg:flex">
      {!online && (
        <span
          className="badge badge-red"
          title="Działają instrukcje zapisane na tym urządzeniu"
        >
          Bez internetu
        </span>
      )}
      {now ? (
        <>
          <span>
            {now.toLocaleDateString("pl-PL", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </span>
          <time
            dateTime={now.toISOString()}
            className="min-w-[5ch] text-right text-base font-semibold text-ink"
          >
            {now.toLocaleTimeString("pl-PL", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        </>
      ) : (
        <span aria-hidden="true" className="min-w-[5ch] text-base">
          &nbsp;
        </span>
      )}
    </span>
  );
}

export function Header({ cars }: { cars: CarSummary[] }) {
  const pathname = usePathname();
  const car = useActiveCar(cars);
  const hasManuals = hasReadableManual(cars);
  const hydrated = useHydrated();
  const hint = useLayoutHint();
  const data = useAppData();
  const due = hydrated
    ? dueSoon(data.reminders, todayIso(), data.settings.ownedCars).length
    : hint.due;
  const nav: { href: string; label: string; exact?: boolean; badge?: number }[] = [
    { href: "/", label: "Profil", exact: true },
    ...(car
      ? [{ href: car.href, label: `${car.brand} ${car.model}` }]
      : hasManuals
        ? [{ href: "/auta", label: "Wybierz auto" }]
        : []),
    { href: "/przypomnienia", label: "Przypomnienia", badge: due },
    { href: "/notatnik", label: "Notatnik" },
    { href: "/komentarze", label: "Komentarze" },
    { href: "/zakladki", label: "Zakładki" },
    { href: "/ustawienia", label: "Ustawienia" },
  ];
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLElement>(null);

  // Exposes the header height for sticky sidebars and anchor scrolling.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () =>
      document.documentElement.style.setProperty(
        "--header-h",
        `${el.offsetHeight}px`,
      );
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    setOpen(false);
    router.push(q ? `/szukaj?q=${encodeURIComponent(q)}` : "/szukaj");
  };

  return (
    <header
      ref={ref}
      className="silver-bar sticky top-0 z-40 border-t-4 border-t-red print:hidden"
    >
      <div className="mx-auto flex h-14 max-w-app items-center gap-3 px-3 lg:px-5">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 text-black"
          aria-label="Strona główna"
        >
          {car ? (
            <CarLogo carId={car.id} brand={car.brand} size={34} />
          ) : (
            <Logo size={34} />
          )}
          <span className="hidden leading-tight sm:block">
            <span className="block text-sm font-semibold tracking-wide uppercase">
              {car ? `${car.brand} ${car.model}` : "Moje instrukcje"}
            </span>
            <span className="block text-[0.6875rem] tracking-[0.12em] text-steel uppercase">
              {car ? `Instrukcja · ${car.year}` : "Profil na tym urządzeniu"}
            </span>
          </span>
        </Link>

        <form
          onSubmit={onSearch}
          role="search"
          className="ml-auto flex max-w-sm min-w-0 flex-1"
        >
          <input
            type="search"
            className="field h-9 min-w-0 border-r-0"
            placeholder={
              car
                ? `Szukaj: ${car.brand} ${car.model}…`
                : "Szukaj w instrukcjach…"
            }
            aria-label="Szukaj w instrukcjach"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="btn h-9" aria-label="Szukaj">
            <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
              <circle
                cx="8.5"
                cy="8.5"
                r="5.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <path
                d="M12.6 12.6 17 17"
                stroke="currentColor"
                strokeWidth="1.8"
              />
            </svg>
          </button>
        </form>

        <button
          type="button"
          className="btn btn-ghost h-9 lg:hidden"
          aria-expanded={open}
          aria-controls="main-nav"
          onClick={() => setOpen((v) => !v)}
        >
          Menu
        </button>
      </div>

      <nav
        id="main-nav"
        aria-label="Główna nawigacja"
        className={`${open ? "block" : "hidden"} border-t border-line bg-white lg:block lg:bg-transparent`}
      >
        <div className="mx-auto flex max-w-app items-center">
        <ul className="flex min-w-0 flex-1 flex-col lg:flex-row lg:flex-wrap lg:px-3">
          {nav.map((item) => {
            const active =
              pathname === item.href ||
              (!item.exact && pathname.startsWith(`${item.href}/`));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm lg:px-3 ${
                    active
                      ? "border-red font-semibold text-ink"
                      : "border-transparent text-graphite hover:border-silver hover:text-ink"
                  }`}
                >
                  {item.label}
                  {item.badge ? (
                    <span
                      className="nav-count"
                      title="Terminy, które minęły albo mijają w ciągu 30 dni"
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
        <Clock />
        </div>
      </nav>
    </header>
  );
}
