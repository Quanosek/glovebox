import type { ReactNode } from "react";
import { Skeleton } from "@/components/Skeleton";
import type { SystemStatus } from "./wizardModel";

export function Availability({
  online,
  system,
  error,
  checking,
  onCheck,
  onResume,
}: {
  online: boolean;
  system: SystemStatus | null;
  error: string | null;
  checking: boolean;
  onCheck: () => void;
  onResume: (id: string) => void;
}) {
  let title: string;
  let text: ReactNode;
  let action: ReactNode = (
    <button type="button" className="btn" onClick={onCheck} disabled={checking}>
      {checking ? "Sprawdzanie…" : "Sprawdź ponownie"}
    </button>
  );
  const running = system?.runningJob;
  if (!online || error) {
    title = "Brak połączenia";
    text =
      "Dodawanie instrukcji wymaga połączenia z aplikacją. Zapisane auta możesz dalej czytać – wróć tutaj, gdy połączenie wróci.";
  } else if (!system) {
    return checking ? (
      <div
        className="mt-4 flex min-h-20 items-center gap-4 border-l-4 border-silver bg-paper px-4 py-3"
        aria-busy="true"
      >
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <Skeleton className="h-9 w-36 shrink-0" />
      </div>
    ) : null;
  } else if (running) {
    title = "Trwa dodawanie innego auta";
    text = `Aplikacja odczytuje właśnie instrukcje auta ${running.label || "dodanego przed chwilą"}. Nowe auto dodasz, gdy to się zakończy.`;
    action = (
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => onResume(running.id)}
      >
        Pokaż postęp
      </button>
    );
  } else if (!system.localAccess) {
    title = "Dodawanie tylko na komputerze z aplikacją";
    text =
      "Ze względów bezpieczeństwa nowe auta można dodawać wyłącznie na komputerze, na którym działa aplikacja. Czytanie instrukcji działa na wszystkich urządzeniach.";
  } else if (
    !system.nodeReady ||
    !system.pythonReady ||
    !system.extractor ||
    !system.database.writable
  ) {
    title = "Ten komputer nie jest jeszcze gotowy";
    text = (
      <>
        Aplikacja nie potrafi tu jeszcze odczytywać plików PDF. Poproś osobę,
        która ją uruchomiła, o jednorazowe przygotowanie – opis znajdzie w
        instrukcji aplikacji (plik README, rozdział „Dodawanie aut”).
      </>
    );
  } else {
    return system.manuals.count === 0 ? (
      <p className="mt-4 border-l-4 border-graphite bg-paper px-4 py-3 text-sm text-graphite">
        Nie ma tu jeszcze instrukcji. Dodaj pierwsze auto, aby rozpocząć
        korzystanie z biblioteki.
      </p>
    ) : null;
  }
  return (
    <div
      role="status"
      className="mt-4 flex flex-col gap-3 border-l-4 border-red bg-paper px-4 py-3 text-sm sm:flex-row sm:items-center"
    >
      <div className="flex-1">
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-graphite">{text}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
