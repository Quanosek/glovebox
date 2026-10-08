#!/usr/bin/env node
// Runs scripts/extract.py for every book in scripts/manuals.config.json.
// Usage: pnpm extract [--book manual] [<extra extract.py args>]
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(
  readFileSync(path.join(root, "scripts/manuals.config.json"), "utf8"),
);

// A literal "--" (npm-style separator) would end option parsing in argparse.
const argv = process.argv.slice(2).filter((a) => a !== "--");
let only = null;
const bookFlag = argv.indexOf("--book");
if (bookFlag !== -1) {
  only = argv[bookFlag + 1];
  argv.splice(bookFlag, 2);
}

function findPython() {
  const candidates = [
    process.env.PYTHON,
    path.join(root, ".venv/bin/python"),
    path.join(root, ".venv/Scripts/python.exe"),
    "python3",
    "python",
    "py",
  ].filter(Boolean);
  for (const cmd of candidates) {
    if (cmd.includes(path.sep) && !existsSync(cmd)) continue;
    const r = spawnSync(cmd, ["-c", "import pymupdf, PIL"], {
      stdio: "ignore",
    });
    if (r.status === 0) return cmd;
  }
  return null;
}

const python = findPython();
if (!python) {
  console.error(
    [
      "Python 3 with PyMuPDF and Pillow is required.",
      "Install (recommended in a virtualenv):",
      "  python3 -m venv .venv",
      "  .venv/bin/python -m pip install -r scripts/requirements.txt   (Windows: .venv\\Scripts\\python -m pip ...)",
    ].join("\n"),
  );
  process.exit(2);
}

let failed = false;
for (const book of config.books) {
  if (only && book.id !== only) continue;
  const pdf = path.join(root, book.file);
  if (!existsSync(pdf)) {
    console.error(`✗ ${book.file} missing — run \`pnpm fetch-manuals\` first.`);
    failed = true;
    continue;
  }
  const args = [
    path.join(root, "scripts/extract.py"),
    "--book",
    book.id,
    "--pdf",
    pdf,
    "--out",
    path.join(root, book.out),
    "--assets",
    path.join(root, book.assets),
    "--assets-url",
    book.assetsUrl,
    "--title",
    book.title,
    "--source-url",
    book.url,
    ...(book.args ?? []),
    ...argv,
  ];
  const r = spawnSync(python, args, { stdio: "inherit", cwd: root });
  if (r.status !== 0) failed = true;
}
// `database/` is not in the repository: describe the car so the app lists it.
const carFile = path.join(root, "database", config.car.id, "car.json");
if (!failed && !existsSync(carFile)) {
  mkdirSync(path.dirname(carFile), { recursive: true });
  const car = {
    formatVersion: 1,
    ...config.car,
    createdAt: new Date().toISOString(),
  };
  writeFileSync(carFile, `${JSON.stringify(car, null, 2)}\n`, "utf8");
  console.log(`✓ ${path.relative(root, carFile)} written`);
}
process.exit(failed ? 1 : 0);
