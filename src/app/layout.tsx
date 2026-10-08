import type { Metadata, Viewport } from "next";
import { ClientEffects } from "@/components/ClientEffects";
import { Header } from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Opel Cascada MY16 — instrukcja",
    template: "%s · Opel Cascada MY16",
  },
  description:
    "Prywatna, lokalna wersja instrukcji obsługi Opel Cascada MY16 i systemu Navi 950 z zakreślaczem, komentarzami i notatnikiem.",
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
        <Header />
        <ClientEffects />
        {children}
        <footer className="mt-auto border-t border-line bg-paper px-5 py-3 text-xs text-steel print:hidden">
          Treść instrukcji © Opel / Stellantis — wyłącznie do prywatnego użytku.
          Notatki są zapisywane tylko w tej przeglądarce.
        </footer>
      </body>
    </html>
  );
}
