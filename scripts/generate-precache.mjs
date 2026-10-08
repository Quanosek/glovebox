#!/usr/bin/env node
// Post-build step: injects the list of exported files into out/sw.js so the
// service worker can precache the whole static app for offline use.
import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "out");
const swFile = path.join(outDir, "sw.js");
const PLACEHOLDER = "self.__PRECACHE_MANIFEST";
const SKIP = new Set(["sw.js"]);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((e) => {
      const full = path.join(dir, e.name);
      return e.isDirectory() ? walk(full) : [full];
    }),
  );
  return files.flat();
}

/** Maps an exported file to the URL it is served under (clean URLs). */
function toUrl(file) {
  let rel = `/${path.relative(outDir, file).split(path.sep).join("/")}`;
  if (rel === "/index.html") return "/";
  if (rel.endsWith("/index.html")) return rel.slice(0, -"index.html".length);
  if (rel.endsWith(".html")) rel = rel.slice(0, -".html".length);
  return rel;
}

try {
  await stat(swFile);
} catch {
  console.error("out/sw.js not found — run `next build` first.");
  process.exit(1);
}

const files = (await walk(outDir)).filter((f) => !SKIP.has(path.relative(outDir, f)));
const hash = createHash("sha256");
let bytes = 0;
const urls = [];
for (const file of files.sort()) {
  const data = await readFile(file);
  hash.update(path.relative(outDir, file)).update(data);
  bytes += data.length;
  urls.push(encodeURI(toUrl(file)));
}
const manifest = { version: hash.digest("hex").slice(0, 12), urls };

const sw = await readFile(swFile, "utf8");
if (!sw.includes(PLACEHOLDER)) {
  console.error(`Placeholder ${PLACEHOLDER} not found in out/sw.js`);
  process.exit(1);
}
await writeFile(swFile, sw.replace(`${PLACEHOLDER} ||`, `${JSON.stringify(manifest)} ||`));
console.log(
  `✓ Service worker precache: ${urls.length} files, ${(bytes / 1024 / 1024).toFixed(1)} MB, version ${manifest.version}`,
);
