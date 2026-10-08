import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Locates a supported Python interpreter with PyMuPDF and Pillow (needed by
 * `scripts/extract.py`).
 */

export interface PythonInfo {
  command: string;
  version: string;
  pymupdf: string | null;
  pillow: string | null;
}

function versionAtLeast(actual: string | null, required: string): boolean {
  const parts = actual
    ?.match(/\d+(?:\.\d+)*/)?.[0]
    .split(".")
    .map(Number);
  const minimum = required.split(".").map(Number);
  if (!parts) return false;
  for (let i = 0; i < minimum.length; i++) {
    const left = parts[i] ?? 0;
    if (left !== minimum[i]) return left > minimum[i];
  }
  return true;
}

export function isSupportedPython(info: PythonInfo): boolean {
  return (
    versionAtLeast(info.version, "3.10") &&
    versionAtLeast(info.pymupdf, "1.26") &&
    versionAtLeast(info.pillow, "12.3")
  );
}

const PROBE = [
  "import json, sys",
  "def v(m):",
  "    try:",
  "        mod = __import__(m)",
  "        return getattr(mod, '__version__', None) or getattr(mod, 'VersionBind', None) or 'ok'",
  "    except Exception:",
  "        return None",
  "print(json.dumps({'version': sys.version.split()[0], 'pymupdf': v('pymupdf'), 'pillow': v('PIL')}))",
].join("\n");

function candidates(): string[] {
  // Runtime-only lookup: keep the bundler from tracing the venv symlinks,
  // which point outside the project and break `next build`.
  const root = process.cwd();
  return [
    process.env.PYTHON,
    path.join(/* turbopackIgnore: true */ root, ".venv", "bin", "python"),
    path.join(
      /* turbopackIgnore: true */ root,
      ".venv",
      "Scripts",
      "python.exe",
    ),
    "python3",
    "python",
    "py",
  ].filter((c): c is string => Boolean(c));
}

export function run(
  command: string,
  args: string[],
  opts: { timeoutMs?: number; onLine?: (line: string) => void } = {},
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let child;
    try {
      child = spawn(command, args, {
        cwd: process.cwd(),
        env: {
          ...process.env,
          PYTHONIOENCODING: "utf-8",
          PYTHONUNBUFFERED: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (err) {
      resolve({ code: null, stdout, stderr: String(err) });
      return;
    }
    const timer = opts.timeoutMs
      ? setTimeout(() => child.kill(), opts.timeoutMs)
      : undefined;
    const feed = (chunk: Buffer, sink: "out" | "err") => {
      const text = chunk.toString("utf8");
      if (sink === "out") stdout += text;
      else stderr += text;
      if (opts.onLine)
        for (const line of text.split(/\r?\n/))
          if (line.trim()) opts.onLine(line);
    };
    child.stdout.on("data", (c: Buffer) => feed(c, "out"));
    child.stderr.on("data", (c: Buffer) => feed(c, "err"));
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ code: null, stdout, stderr: stderr + String(err) });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

let cached: {
  at: number;
  value: PythonInfo | null;
  found: PythonInfo[];
} | null = null;

/** Returns the best interpreter plus every Python found (for diagnostics). */
export async function findPython(
  force = false,
): Promise<{ best: PythonInfo | null; found: PythonInfo[] }> {
  if (!force && cached && Date.now() - cached.at < 15_000)
    return { best: cached.value, found: cached.found };
  const found: PythonInfo[] = [];
  for (const command of candidates()) {
    if (command.includes(path.sep) && !fs.existsSync(command)) continue;
    const r = await run(command, ["-c", PROBE], { timeoutMs: 15_000 });
    if (r.code !== 0) continue;
    try {
      const info = JSON.parse(r.stdout.trim().split("\n").pop() ?? "");
      const python = { command, ...info } as PythonInfo;
      if (isSupportedPython(python)) found.push(python);
    } catch {
      // not a usable interpreter
    }
  }
  const best = found.find((p) => p.pymupdf && p.pillow) ?? null;
  cached = { at: Date.now(), value: best, found };
  return { best, found };
}
