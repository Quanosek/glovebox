#!/usr/bin/env node
// Renders src/app/icon.svg (the Glovebox mark) into every raster icon the
// browsers need. Usage: pnpm icons
// - src/app/favicon.ico: 16/32/48 px PNG-in-ICO (legacy tab icon);
// - src/app/apple-icon.png: 180×180 (iOS home screen);
// - public/icon-192.png, public/icon-512.png: web app manifest icons;
// - public/icon-maskable-512.png: manifest icon with the mark inside the
//   maskable safe zone (Android adaptive icons).
// The SVG itself switches to a dark tile under `prefers-color-scheme: dark`;
// raster icons cannot, so they always use the light (default) colours.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appDir = path.join(root, "src/app");
const publicDir = path.join(root, "public");
const source = await readFile(path.join(appDir, "icon.svg"), "utf8");
// Drop the dark-scheme rules so the light colours are rendered.
const svg = Buffer.from(
  source.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, ""),
);
const BACKGROUND = "#ffffff";

const png = (size) =>
  sharp(svg, { density: Math.ceil((72 * size) / 64) * 2 })
    .resize(size, size)
    .flatten({ background: BACKGROUND })
    .ensureAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer();

// The mark scaled to 72% keeps its farthest corner inside the 80% circle.
const maskable = async (size) => {
  const inner = Math.round(size * 0.72);
  const pad = Math.floor((size - inner) / 2);
  return sharp(await png(inner))
    .extend({
      top: pad,
      bottom: size - inner - pad,
      left: pad,
      right: size - inner - pad,
      background: BACKGROUND,
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
};

await writeFile(path.join(appDir, "apple-icon.png"), await png(180));
await writeFile(path.join(publicDir, "icon-192.png"), await png(192));
await writeFile(path.join(publicDir, "icon-512.png"), await png(512));
await writeFile(
  path.join(publicDir, "icon-maskable-512.png"),
  await maskable(512),
);

// ICO container with embedded PNG images (supported by all modern browsers).
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map(png));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
const entries = [];
let offset = 6 + 16 * sizes.length;
sizes.forEach((size, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(size, 0);
  e.writeUInt8(size, 1);
  e.writeUInt8(0, 2);
  e.writeUInt8(0, 3);
  e.writeUInt16LE(1, 4);
  e.writeUInt16LE(32, 6);
  e.writeUInt32LE(images[i].length, 8);
  e.writeUInt32LE(offset, 12);
  offset += images[i].length;
  entries.push(e);
});
await writeFile(
  path.join(appDir, "favicon.ico"),
  Buffer.concat([header, ...entries, ...images]),
);
console.log(
  "✓ favicon.ico, apple-icon.png, icon-192.png, icon-512.png, icon-maskable-512.png generated from src/app/icon.svg",
);
