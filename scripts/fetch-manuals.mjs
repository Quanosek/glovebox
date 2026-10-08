#!/usr/bin/env node
// Downloads the source PDF manuals listed in scripts/manuals.config.json
// into ./manuals (ignored by git). Usage: npm run fetch-manuals [-- --force]
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(
  await readFile(path.join(root, "scripts/manuals.config.json"), "utf8"),
);
const force = process.argv.includes("--force");

let failed = false;
for (const book of config.books) {
  const target = path.join(root, book.file);
  await mkdir(path.dirname(target), { recursive: true });
  if (!force) {
    try {
      const s = await stat(target);
      if (s.size > 0) {
        console.log(
          `✓ ${book.file} already exists (use --force to re-download)`,
        );
        continue;
      }
    } catch {
      // not downloaded yet
    }
  }
  console.log(`↓ ${book.url}`);
  const tmp = `${target}.part`;
  try {
    const res = await fetch(book.url, {
      headers: {
        "user-agent": "Mozilla/5.0 (opel-cascada-manual fetch script)",
      },
    });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));
    const head = (await readFile(tmp)).subarray(0, 5).toString("latin1");
    if (head !== "%PDF-") throw new Error("downloaded file is not a PDF");
    await rename(tmp, target);
    console.log(`✓ saved ${book.file}`);
  } catch (err) {
    failed = true;
    await unlink(tmp).catch(() => {});
    console.error(`✗ ${book.id}: ${err.message}`);
    console.error(
      `  Download it manually from the URL above and save it as ${book.file}`,
    );
  }
}
process.exit(failed ? 1 : 0);
