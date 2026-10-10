import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

const app = manifest();

/** Static files are served from public/, metadata icons from src/app/. */
function file(url: string): string {
  const name = url.replace(/^\//, "").split("?")[0];
  const inPublic = path.join("public", name);
  return existsSync(inPublic) ? inPublic : path.join("src/app", name);
}

/** Width and height from the header of a PNG or a lossy/lossless WebP. */
function dimensions(name: string): string {
  const b = readFileSync(name);
  if (b.toString("ascii", 1, 4) === "PNG")
    return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
  const chunk = b.toString("ascii", 12, 16);
  if (chunk === "VP8X")
    return `${b.readUIntLE(24, 3) + 1}x${b.readUIntLE(27, 3) + 1}`;
  if (chunk === "VP8 ")
    return `${b.readUInt16LE(26) & 0x3fff}x${b.readUInt16LE(28) & 0x3fff}`;
  const bits = b.readUInt32LE(21);
  return `${(bits & 0x3fff) + 1}x${((bits >> 14) & 0x3fff) + 1}`;
}

describe("web app manifest", () => {
  it("describes an installable standalone app", () => {
    expect(app).toMatchObject({
      id: "/",
      start_url: "/",
      scope: "/",
      display: "standalone",
      lang: "pl",
    });
    expect(app.name && app.short_name && app.description).toBeTruthy();
    expect(app.theme_color).toBe(app.background_color);
  });

  it("lists existing icons for every purpose in their declared sizes", () => {
    const icons = app.icons ?? [];
    for (const icon of icons) {
      expect(existsSync(file(icon.src)), icon.src).toBe(true);
      if (icon.sizes !== "any")
        expect(dimensions(file(icon.src)), icon.src).toBe(icon.sizes);
    }
    const sized = (purpose: string, size: string) =>
      icons.some((i) => (i.purpose ?? "any") === purpose && i.sizes === size);
    expect(sized("any", "192x192") && sized("any", "512x512")).toBe(true);
    expect(sized("maskable", "512x512")).toBe(true);
    expect(sized("monochrome", "512x512")).toBe(true);
  });

  it("has wide and narrow screenshots in their declared sizes", () => {
    const shots = app.screenshots ?? [];
    expect(shots.map((s) => s.form_factor).sort()).toEqual(["narrow", "wide"]);
    for (const shot of shots)
      expect(dimensions(file(shot.src)), shot.src).toBe(shot.sizes);
  });

  it("points shortcuts at existing pages", () => {
    for (const shortcut of app.shortcuts ?? [])
      expect(
        existsSync(path.join("src/app", shortcut.url, "page.tsx")),
        shortcut.url,
      ).toBe(true);
  });

  it("is pre-cached with its icons by the service worker", () => {
    const sw = readFileSync("public/sw.js", "utf8");
    const shell = /const SHELL = \[([\s\S]*?)\];/.exec(sw)?.[1] ?? "";
    const urls = [...shell.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(urls).toContain("/manifest.webmanifest");
    for (const url of urls.filter((u) => /\.(png|webp|svg)$/.test(u)))
      expect(existsSync(file(url)), url).toBe(true);
    for (const url of urls.filter((u) => !/\.\w+$/.test(u) && u !== "/"))
      expect(existsSync(path.join("src/app", url, "page.tsx")), url).toBe(true);
  });
});
