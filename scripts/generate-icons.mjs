#!/usr/bin/env node
// Renders src/app/icon.svg into apple-icon.png (180×180) and favicon.ico
// (16/32/48 px PNG-in-ICO). Usage: npm run icons
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appDir = path.join(root, "src/app");
const svg = await readFile(path.join(appDir, "icon.svg"));

const png = (size) =>
  sharp(svg, { density: Math.ceil((72 * size) / 64) * 2 })
    .resize(size, size)
    .flatten({ background: "#ffffff" })
    .ensureAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer();

await writeFile(path.join(appDir, "apple-icon.png"), await png(180));

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
await writeFile(path.join(appDir, "favicon.ico"), Buffer.concat([header, ...entries, ...images]));
console.log("✓ apple-icon.png, favicon.ico generated from src/app/icon.svg");
