import Link from "next/link";

export default function NotFound() {
  return (
    <main
      id="main"
      className="page-shell py-16 text-center"
    >
      <p className="text-6xl font-light text-silver">404</p>
      <h1 className="mt-2 text-xl font-semibold">Nie znaleziono strony</h1>
      <p className="mt-2 text-graphite">
        Ta sekcja nie istnieje albo treść instrukcji się zmieniła.
      </p>
      <Link href="/" className="btn btn-primary mt-6">
        Strona główna
      </Link>
    </main>
  );
}
