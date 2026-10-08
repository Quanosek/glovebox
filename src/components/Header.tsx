"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { equipmentHref, type CarSummary } from "@/lib/cars";
import { useOnline } from "@/lib/offline";
import { useActiveCar } from "@/lib/storage/hooks";
import { CarLogo } from "./CarLogo";
import { Logo } from "./Logo";

export function Header({ cars }: { cars: CarSummary[] }) {
  const pathname = usePathname();
  const car = useActiveCar(cars);
  const online = useOnline();
  const nav = [
    { href: "/", label: "Profil", exact: true },
    car
      ? { href: car.href, label: `${car.brand} ${car.model}` }
      : { href: "/auta", label: "Wybierz auto" },
    ...(car ? [{ href: equipmentHref(car.id), label: "Wyposażenie" }] : []),
    { href: "/ostrzezenia", label: "Ostrzeżenia" },
    { href: "/komentarze", label: "Komentarze" },
    { href: "/zakladki", label: "Zakładki" },
    { href: "/notatnik", label: "Notatnik" },
    { href: "/dodaj-auto", label: "Dodaj auto" },
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

        {!online && (
          <span
            className="badge badge-dark shrink-0"
            title="Brak internetu – działają instrukcje zapisane na tym urządzeniu"
          >
            Bez internetu
          </span>
        )}

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
          className="btn btn-ghost h-9 xl:hidden"
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
        className={`${open ? "block" : "hidden"} border-t border-line bg-white xl:block xl:bg-transparent`}
      >
        <ul className="mx-auto flex max-w-app flex-col xl:flex-row xl:px-3">
          {nav.map((item) => {
            const active =
              pathname === item.href ||
              (!("exact" in item) && pathname.startsWith(`${item.href}/`));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`block border-b-2 px-4 py-2 text-sm xl:px-3 ${
                    active
                      ? "border-red font-semibold text-ink"
                      : "border-transparent text-graphite hover:border-silver hover:text-ink"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
