import fs from "node:fs/promises";
import path from "node:path";
import { getDatabaseDir } from "@/lib/content";
import { prewarmEuropeanCatalog } from "@/lib/server/catalog";
import { prewarmLogoMetadata } from "@/lib/server/logos";

/** Create only cache directories, never cars, manuals or example content. */
export async function initializeDatabase(): Promise<{
  failed: string[];
  warnings: string[];
}> {
  const database = getDatabaseDir();
  await Promise.all(
    [".catalog", ".logos"].map((directory) =>
      fs.mkdir(path.join(database, directory), { recursive: true }),
    ),
  );
  const { brands, failed } = await prewarmEuropeanCatalog();
  const reasons = new Set<string>();
  const failedLogos = await prewarmLogoMetadata(brands, (reason) =>
    reasons.add(reason),
  );
  const warnings = failedLogos.length
    ? [
        `Nie udało się przygotować logotypów ${failedLogos.length} z ${brands.length} marek. ${[...reasons].slice(0, 3).join("; ")}. Logotypy są opcjonalne; zapisane dane zachowano. Przy HTTP 403/429 sprawdź dostęp do Wikidanych i ograniczenia sieci. Ponów pnpm initial po godzinie przy działającym połączeniu.`,
      ]
    : [];
  return { failed, warnings };
}
