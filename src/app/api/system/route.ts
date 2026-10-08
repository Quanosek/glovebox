import fs from "node:fs/promises";
import path from "node:path";
import { getDatabaseDir } from "@/lib/content";
import { isLoopbackHost } from "@/lib/server/guard";
import { findPython } from "@/lib/server/python";
import {
  MAX_DOCUMENTS,
  MAX_FILE_BYTES,
  runningJob,
} from "@/lib/server/importer";

export const dynamic = "force-dynamic";

/** Environment check shown in step 1 of the import wizard. */
export async function GET(request: Request) {
  const { best, found } = await findPython(true);
  const db = getDatabaseDir();
  let databaseWritable = false;
  try {
    await fs.mkdir(db, { recursive: true });
    const probe = path.join(db, `.write-test-${process.pid}`);
    await fs.writeFile(probe, "");
    await fs.rm(probe);
    databaseWritable = true;
  } catch {
    databaseWritable = false;
  }
  let extractor = false;
  try {
    await fs.access(path.join(process.cwd(), "scripts", "extract.py"));
    extractor = true;
  } catch {
    extractor = false;
  }
  const busy = runningJob();
  const localAccess =
    process.env.MANUALS_ALLOW_REMOTE_IMPORT === "1" ||
    isLoopbackHost(request.headers.get("host") ?? "");
  return Response.json({
    node: process.version,
    platform: process.platform,
    python: best ?? found[0] ?? null,
    pythonReady: Boolean(best),
    extractor,
    database: {
      path: path.relative(process.cwd(), db) || db,
      writable: databaseWritable,
    },
    limits: { maxDocuments: MAX_DOCUMENTS, maxFileBytes: MAX_FILE_BYTES },
    localAccess,
    runningJob: busy?.id ? { id: busy.id, label: busy.label } : null,
  });
}
