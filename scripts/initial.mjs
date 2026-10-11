import { register } from "node:module";

register("./initial-loader.mjs", import.meta.url);

try {
  const { initializeDatabase } = await import("../src/lib/server/initial.ts");
  console.log(
    "Przygotowywanie katalogu europejskich aut i informacji o logotypach…",
  );
  const { failed, warnings } = await initializeDatabase();
  for (const warning of warnings) console.warn(warning);
  if (failed.length) {
    console.warn(
      `Nie udało się przygotować modeli ${failed.length} marek: ${failed.slice(0, 5).join(", ")}${failed.length > 5 ? ", …" : ""}.`,
    );
    console.warn(
      "Dostępne dane zachowano. Uruchom ponownie pnpm initial przy działającym połączeniu.",
    );
    process.exitCode = 1;
  } else {
    console.log(
      "Katalog przygotowany. Możesz uruchomić aplikację i dodać własne instrukcje.",
    );
  }
} catch {
  console.error(
    "Nie udało się przygotować katalogu. Sprawdź połączenie z internetem i możliwość zapisu, a następnie uruchom ponownie pnpm initial. Zapisane wcześniej dane pozostają bez zmian.",
  );
  process.exitCode = 1;
}
