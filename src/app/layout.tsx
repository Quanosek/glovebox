import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { BackButton } from "@/components/BackButton";
import { ClientEffects } from "@/components/ClientEffects";
import { DialogHost } from "@/components/Dialog";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { LayoutHintProvider } from "@/lib/storage/hintContext";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/brand";
import { listCarSummaries } from "@/lib/content";
import { HINT_COOKIE, parseHint } from "@/lib/storage/hint";
import "./globals.css";

// Every page reads `database/`, which changes when cars are imported.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  // iOS/iPadOS home screen app (the manifest covers the other platforms).
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
  // Page numbers and part numbers of manuals are not phone numbers.
  formatDetection: { telephone: false, email: false, address: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
  colorScheme: "light",
  // The on-screen keyboard shrinks the layout instead of covering the notebook.
  interactiveWidget: "resizes-content",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Summary of the browser data so the first paint matches the hydrated page.
  const hint = parseHint((await cookies()).get(HINT_COOKIE)?.value);
  const cars = listCarSummaries();
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
      <body className="app-body flex min-h-full flex-col">
        <LayoutHintProvider hint={hint}>
          <a
            href="#main"
            className="sr-only z-50 bg-white p-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
          >
            Przejdź do treści
          </a>
          <Header cars={cars} />
          <BackButton variant="page" />
          <ClientEffects />
          {children}
          <DialogHost />
          <Footer />
        </LayoutHintProvider>
      </body>
    </html>
  );
}
