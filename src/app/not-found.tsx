import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 text-center">
      <p className="text-6xl font-light text-silver">404</p>
      <h1 className="mt-2 text-xl font-semibold">Nie znaleziono strony</h1>
      <p className="mt-2 text-graphite">Ta sekcja nie istnieje lub treść instrukcji została wygenerowana ponownie.</p>
      <Link href="/" className="btn btn-primary mt-6">
        Strona główna
      </Link>
    </main>
  );
}
