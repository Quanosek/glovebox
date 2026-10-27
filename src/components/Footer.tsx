import Image from "next/image";
import { APP_REPOSITORY_URL } from "@/lib/brand";
import { ProjectLinks } from "./ProjectLinks";

export function Footer() {
  return (
    <footer className="app-footer mt-auto border-t border-line bg-paper print:hidden">
      <div className="app-frame space-y-3">
        <div className="flex justify-end">
          <ProjectLinks />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-t border-line pt-3 text-xs leading-relaxed text-graphite">
          <p className="min-w-0 flex-[1_1_32rem] text-[0.6875rem]">
            Możesz używać, modyfikować i rozpowszechniać projekt zgodnie z
            warunkami licencji{" "}
            <a
              href={`${APP_REPOSITORY_URL}/blob/HEAD/LICENSE`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
              aria-label="Licencja GNU AGPL v3.0 (otwiera nową kartę)"
            >
              GNU AGPL v3.0
            </a>
            . Przy udostępnianiu zmodyfikowanej wersji przez sieć udostępnij jej
            użytkownikom odpowiadający kod źródłowy (sekcja 13). Oprogramowanie
            jest dostarczane bez gwarancji. Notatki i ustawienia zapisują się w
            tej przeglądarce; nie publikuj swoich prywatnych danych ani treści
            instrukcji bez odpowiednich uprawnień. Znaki towarowe należą do ich
            właścicieli.
          </p>
          <p className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
            <span>Jakub Kłało ©</span>
            <a
              href="https://www.klalo.pl"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
              aria-label="klalo.pl (otwiera nową kartę)"
            >
              klalo.pl
            </a>
            <Image
              src="/author-mark.png"
              width={15}
              height={15}
              alt=""
              unoptimized
              className="shrink-0 opacity-60 brightness-0"
            />
          </p>
        </div>
      </div>
    </footer>
  );
}
