import type { Metadata, Viewport } from "next";
import { ClientEffects } from "@/components/ClientEffects";
import { DialogHost } from "@/components/Dialog";
import { Header } from "@/components/Header";
import { BackButton } from "@/components/BackButton";
import { listCarSummaries } from "@/lib/content";
import "./globals.css";

// Every page reads `database/`, which changes when cars are imported.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "Moje instrukcje aut",
    template: "%s · Moje instrukcje aut",
  },
  description:
    "Prywatna biblioteka instrukcji samochodowych wszystkich marek z zaznaczeniami, komentarzami i notatnikiem.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pl" className="h-full antialiased">
      <head>
        {/* eslint-disable-next-line @next/next/no-css-tags -- see public/highlights.css */}
        <link rel="stylesheet" href="/highlights.css" />
      </head>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only z-50 bg-white p-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          Przejdź do treści
        </a>
        <Header cars={listCarSummaries()} />
        <BackButton />
        <ClientEffects />
        {children}
        <DialogHost />
        <footer className="mt-auto border-t border-line bg-paper px-5 py-3 text-xs text-steel print:hidden">
          <p className="mx-auto max-w-app">
            Treść instrukcji należy do producentów aut i służy wyłącznie do
            użytku prywatnego. Notatki zapisują się tylko w tej przeglądarce.
          </p>
        </footer>
      </body>
    </html>
  );
}
