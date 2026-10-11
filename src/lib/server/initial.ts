import fs from "node:fs/promises";
import path from "node:path";
import { getDatabaseDir } from "@/lib/content";
import { prewarmEuropeanCatalog } from "@/lib/server/catalog";
import { prewarmLogoMetadata } from "@/lib/server/logos";

/** Create only cache directories, never cars, manuals or example content. */
export async function initializeDatabase(): Promise<{ failed: string[] }> {
  const database = getDatabaseDir();
  await Promise.all(
    [".catalog", ".logos"].map((directory) =>
      fs.mkdir(path.join(database, directory), { recursive: true }),
    ),
  );
  const { brands, failed } = await prewarmEuropeanCatalog();
  const failedLogos = await prewarmLogoMetadata(brands);
  return { failed: [...failed, ...failedLogos.map((name) => `Logo: ${name}`)] };
}
