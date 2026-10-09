import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { ClientEffects } from "@/components/ClientEffects";
import { DialogHost } from "@/components/Dialog";
import { Header } from "@/components/Header";
import { BackButton } from "@/components/BackButton";
import { LayoutHintProvider } from "@/lib/storage/hintContext";
import { listCarSummaries } from "@/lib/content";
import { HINT_COOKIE, parseHint } from "@/lib/storage/hint";
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

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Summary of the browser data so the first paint matches the hydrated page.
  const hint = parseHint((await cookies()).get(HINT_COOKIE)?.value);
  return (
    <html
      lang="pl"
      className="h-full antialiased"
      data-font-size={hint.fontSize}
    >
      <head>
        {/* eslint-disable-next-line @next/next/no-css-tags -- see public/highlights.css */}
        <link rel="stylesheet" href="/highlights.css" />
      </head>
      <body className="flex min-h-full flex-col">
        <LayoutHintProvider hint={hint}>
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
        </LayoutHintProvider>
      </body>
    </html>
  );
}
