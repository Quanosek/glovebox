import Link from "next/link";
import { APP_NAME, APP_REPOSITORY_URL, APP_VERSION } from "@/lib/brand";
import { Logo } from "./Logo";
import { ProjectLinks } from "./ProjectLinks";

export function Footer() {
  return (
    <footer className="app-footer mt-auto border-t border-line bg-paper print:hidden">
      <div className="app-frame space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/" className="flex items-center gap-2 text-ink">
              <Logo size={28} />
              <span className="type-item">{APP_NAME}</span>
              <span className="text-xs text-graphite">v{APP_VERSION}</span>
            </Link>
            <nav
              aria-label="Nawigacja w stopce"
              className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-graphite"
            >
              <Link href="/">Profil</Link>
              <Link href="/notatnik">Notatnik</Link>
              <Link href="/ustawienia">Ustawienia</Link>
            </nav>
          </div>
          <ProjectLinks />
        </div>
        <div className="flex flex-col gap-2 border-t border-line pt-3 text-xs text-graphite sm:flex-row sm:items-start sm:justify-between sm:gap-8">
          <p>Notatki i ustawienia zapisują się w tej przeglądarce.</p>
          <p>
            Otwarty kod ·{" "}
            <a
              href={`${APP_REPOSITORY_URL}/blob/HEAD/LICENSE`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
              aria-label="Licencja GNU AGPL v3.0 (otwiera nową kartę)"
            >
              GNU AGPL v3.0
            </a>
            {" · "}Bez gwarancji
          </p>
        </div>
      </div>
    </footer>
  );
}
