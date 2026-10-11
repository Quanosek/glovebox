import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let root: string;
let project: string;
let bin: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "glovebox-docker-setup-"));
  project = path.join(root, "project with spaces");
  bin = path.join(root, "bin");
  fs.mkdirSync(path.join(project, "scripts"), { recursive: true });
  fs.mkdirSync(bin);
  for (const file of [
    ".env.example",
    "compose.yaml",
    "scripts/prepare-docker.sh",
  ])
    fs.copyFileSync(path.join(process.cwd(), file), path.join(project, file));
  fs.writeFileSync(
    path.join(bin, "id"),
    '#!/bin/sh\ncase "$1" in\n-u) echo "${TEST_UID:-1500}";;\n-g) echo 1600;;\nesac\n',
    { mode: 0o755 },
  );
  fs.writeFileSync(
    path.join(bin, "docker"),
    '#!/bin/sh\nif [ "$1" = "${TEST_DOCKER_FAILURE:-}" ]; then exit 1; fi\n',
    { mode: 0o755 },
  );
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function prepare(env: Record<string, string> = {}) {
  return spawnSync("sh", [path.join(project, "scripts/prepare-docker.sh")], {
    cwd: root,
    env: {
      ...process.env,
      PATH: `${bin}${path.delimiter}${process.env.PATH}`,
      ...env,
    },
    encoding: "utf8",
  });
}

describe("Docker setup", () => {
  it("prepares a fresh project from another working directory", () => {
    const result = prepare();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("docker compose up -d --build");
    expect(fs.readFileSync(path.join(project, ".env"), "utf8")).toContain(
      "GLOVEBOX_PORT=3000\n\n",
    );
    expect(fs.readFileSync(path.join(project, ".env"), "utf8")).toContain(
      "GLOVEBOX_UID=1500\nGLOVEBOX_GID=1600",
    );
    for (const directory of ["database", ".runtime/tmp", ".runtime/cache"])
      expect(fs.statSync(path.join(project, directory)).isDirectory()).toBe(
        true,
      );
    expect(fs.existsSync(path.join(root, ".env"))).toBe(false);
    expect(fs.statSync(path.join(project, ".env")).mode & 0o777).toBe(0o600);
  });

  it("preserves port and custom settings when adapting a moved installation", () => {
    fs.writeFileSync(
      path.join(project, ".env"),
      "# My settings\nGLOVEBOX_PORT=8080\nGLOVEBOX_UID=123\nGLOVEBOX_GID=456\nCUSTOM=value\n",
    );
    expect(prepare().status).toBe(0);
    expect(fs.readFileSync(path.join(project, ".env"), "utf8")).toBe(
      "# My settings\nGLOVEBOX_PORT=8080\nGLOVEBOX_UID=1500\nGLOVEBOX_GID=1600\nCUSTOM=value\n",
    );
  });

  it("adds missing ownership settings and can be rerun without leftovers", () => {
    fs.writeFileSync(path.join(project, ".env"), "GLOVEBOX_PORT=8081\n");
    expect(prepare().status).toBe(0);
    const saved = fs.readFileSync(path.join(project, ".env"), "utf8");
    expect(saved).toBe(
      "GLOVEBOX_PORT=8081\nGLOVEBOX_UID=1500\nGLOVEBOX_GID=1600\n",
    );
    expect(prepare().status).toBe(0);
    expect(fs.readFileSync(path.join(project, ".env"), "utf8")).toBe(saved);
    expect(
      fs.readdirSync(project).some((file) => file.startsWith(".env.prepare.")),
    ).toBe(false);
  });

  it.each([
    [{ TEST_UID: "0" }, "bez sudo"],
    [{ TEST_DOCKER_FAILURE: "compose" }, "Zainstaluj Docker"],
    [{ TEST_DOCKER_FAILURE: "info" }, "Uruchom Docker"],
  ])("reports prerequisites before creating files: %j", (env, message) => {
    const result = prepare(env);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(message);
    expect(fs.existsSync(path.join(project, ".env"))).toBe(false);
    expect(fs.existsSync(path.join(project, "database"))).toBe(false);
  });
});
