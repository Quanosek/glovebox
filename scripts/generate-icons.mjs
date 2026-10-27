#!/usr/bin/env node
// Renders src/app/icon.svg (the Glovebox mark) into every raster icon the
// browsers need. Usage: pnpm icons
// - src/app/favicon.ico: 16/32/48 px PNG-in-ICO (legacy tab icon);
// - src/app/apple-icon.png: 180×180 (iOS home screen);
// - public/icon-96.png, public/icon-192.png, public/icon-512.png: web app
//   manifest icons (96 px for app shortcuts);
// - public/icon-maskable-192.png, public/icon-maskable-512.png: manifest
//   icons with the mark inside the maskable safe zone (Android adaptive icons);
// - public/icon-monochrome-512.png: the mark alone on transparency, for
//   themed (monochrome) launcher icons.
// - public/icon-dark-512.png, public/icon-light-512.png: theme-specific
//   variants corresponding to public/icon-dark.svg and public/icon-light.svg.
// Raster icons are fixed to the light (default) colours.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appDir = path.join(root, "src/app");
const publicDir = path.join(root, "public");
const source = await readFile(path.join(appDir, "icon.svg"), "utf8");
const darkSource = await readFile(path.join(publicDir, "icon-dark.svg"));
const lightSource = await readFile(path.join(publicDir, "icon-light.svg"));
// Drop the dark-scheme rules so the light colours are rendered.
const svg = Buffer.from(
  source.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, ""),
);
const BACKGROUND = "#ffffff";

const renderPng = (sourceSvg, size, background) => {
  const image = sharp(sourceSvg, { density: Math.ceil((72 * size) / 64) * 2 })
    .resize(size, size)
    .ensureAlpha();
  return (background ? image.flatten({ background }) : image)
    .png({ compressionLevel: 9 })
    .toBuffer();
};

const png = (size) => renderPng(svg, size, BACKGROUND);

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

// Monochrome icon: only the alpha channel matters, so the mark is drawn in
// black on transparency, inside the same safe zone as the maskable icon.
const monochrome = async (size) => {
  const mark = Buffer.from(
    svg
      .toString()
      .replace(/\.bg\s*\{[^}]*\}/, ".bg { fill: none; }")
      .replace(/#2b2e31|#c8102e/g, "#000000"),
  );
  const inner = Math.round(size * 0.72);
  const pad = Math.floor((size - inner) / 2);
  const drawn = await sharp(mark, { density: Math.ceil((72 * inner) / 64) * 2 })
    .resize(inner, inner)
    .png()
    .toBuffer();
  return sharp(drawn)
    .extend({
      top: pad,
      bottom: size - inner - pad,
      left: pad,
      right: size - inner - pad,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
};

await writeFile(path.join(appDir, "apple-icon.png"), await png(180));
await writeFile(path.join(publicDir, "icon-96.png"), await png(96));
await writeFile(path.join(publicDir, "icon-192.png"), await png(192));
await writeFile(path.join(publicDir, "icon-512.png"), await png(512));
await writeFile(
  path.join(publicDir, "icon-dark-512.png"),
  await renderPng(darkSource, 512),
);
await writeFile(
  path.join(publicDir, "icon-light-512.png"),
  await renderPng(lightSource, 512),
);
await writeFile(
  path.join(publicDir, "icon-maskable-192.png"),
  await maskable(192),
);
await writeFile(
  path.join(publicDir, "icon-maskable-512.png"),
  await maskable(512),
);
await writeFile(
  path.join(publicDir, "icon-monochrome-512.png"),
  await monochrome(512),
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
  "✓ favicon.ico, apple-icon.png, manifest icons and theme variants generated",
);
