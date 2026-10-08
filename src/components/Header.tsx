"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Logo } from "./Logo";

const NAV = [
  { href: "/instrukcja", label: "Instrukcja obsługi" },
  { href: "/navi-950", label: "Navi 950" },
  { href: "/twoje-auto", label: "Twoje auto" },
  { href: "/ostrzezenia", label: "Ostrzeżenia" },
  { href: "/komentarze", label: "Komentarze" },
  { href: "/zakladki", label: "Zakładki" },
  { href: "/notatnik", label: "Notatnik" },
  { href: "/ustawienia", label: "Ustawienia" },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLElement>(null);

  // Exposes the header height for sticky sidebars and anchor scrolling.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () =>
      document.documentElement.style.setProperty("--header-h", `${el.offsetHeight}px`);
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
    <header ref={ref} className="silver-bar sticky top-0 z-40 print:hidden">
      <div className="flex h-14 items-center gap-3 border-t-4 border-red px-3 lg:px-5">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 text-black" aria-label="Strona główna">
          <Logo size={34} />
          <span className="hidden leading-tight sm:block">
            <span className="block text-sm font-semibold tracking-wide">OPEL CASCADA</span>
            <span className="block text-[0.6875rem] tracking-[0.12em] text-steel uppercase">
              Instrukcja · MY16
            </span>
          </span>
        </Link>

        <form onSubmit={onSearch} role="search" className="ml-auto flex max-w-sm min-w-0 flex-1">
          <input
            type="search"
            className="field h-9 min-w-0 border-r-0"
            placeholder="Szukaj w instrukcjach…"
            aria-label="Szukaj w instrukcjach"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="btn h-9" aria-label="Szukaj">
            <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
              <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path d="M12.6 12.6 17 17" stroke="currentColor" strokeWidth="1.8" />
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
        <ul className="flex flex-col xl:flex-row xl:px-3">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
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
