// Runs Python with the interpreter the importer would use
// (src/lib/server/python.ts): $PYTHON, then the project .venv, then
// python3 / python / py — the first one that has PyMuPDF and Pillow.
// Usage: node scripts/run-python.mjs <python arguments…>
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const candidates = [
  process.env.PYTHON,
  path.join(root, ".venv", "bin", "python"),
  path.join(root, ".venv", "Scripts", "python.exe"),
  "python3",
  "python",
  "py",
].filter(Boolean);

const python = candidates.find(
  (cmd) =>
    spawnSync(cmd, ["-c", "import pymupdf, PIL"], { stdio: "ignore" })
      .status === 0,
);

if (!python) {
  console.error(
    "No Python with PyMuPDF and Pillow found. Create .venv and run:\n" +
      "  .venv/bin/python -m pip install -r scripts/requirements.txt\n" +
      "or set PYTHON to a suitable interpreter.",
  );
  process.exit(1);
}

const result = spawnSync(python, process.argv.slice(2), {
  cwd: root,
  stdio: "inherit",
});
process.exit(result.status ?? 1);
