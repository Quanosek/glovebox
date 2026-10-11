import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { CarFile } from "@/lib/cars";
import { catalogKey } from "@/lib/catalog";
import { pickLogo, type BrandLogo } from "@/lib/logos";

/**
 * Cache layout of brand logos (`database/.logos/`, docs/logos.md) and the
 * size of an already downloaded logo. Reads the disk only — no network — so
 * page renders can give the logo its final box before the image loads.
 */

export const LOGO_EXTENSIONS = ["png", "jpg", "gif", "webp"] as const;

export const brandMetadataFile = (dir: string, brand: string) =>
  path.join(dir, `brand-${catalogKey(brand).toLowerCase()}.json`);

export const logoImageBase = (dir: string, file: string) =>
  path.join(dir, createHash("sha1").update(file).digest("hex"));

export interface LogoSize {
  width: number;
  height: number;
}

/** Pixel size from the header of a PNG, GIF, JPEG or WebP image. */
export function imageSize(data: Uint8Array): LogoSize | null {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const ascii = (at: number, n: number) =>
    String.fromCharCode(...data.subarray(at, at + n));
  const ok = (size: LogoSize) =>
    size.width > 0 && size.height > 0 ? size : null;
  if (data.length >= 24 && ascii(1, 3) === "PNG")
    return ok({ width: view.getUint32(16), height: view.getUint32(20) });
  if (data.length >= 10 && ascii(0, 3) === "GIF")
    return ok({
      width: view.getUint16(6, true),
      height: view.getUint16(8, true),
    });
  if (data.length >= 30 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    const chunk = ascii(12, 4);
    if (chunk === "VP8X")
      return ok({
        width: 1 + (view.getUint32(24, true) & 0xffffff),
        height: 1 + (view.getUint32(27, true) & 0xffffff),
      });
    if (chunk === "VP8L") {
      const bits = view.getUint32(21, true);
      return ok({
        width: 1 + (bits & 0x3fff),
        height: 1 + ((bits >> 14) & 0x3fff),
      });
    }
    if (chunk === "VP8 ")
      return ok({
        width: view.getUint16(26, true) & 0x3fff,
        height: view.getUint16(28, true) & 0x3fff,
      });
    return null;
  }
  if (data.length >= 4 && data[0] === 0xff && data[1] === 0xd8) {
    let at = 2;
    while (at + 9 < data.length) {
      if (data[at] !== 0xff) return null;
      const marker = data[at + 1];
      const length = view.getUint16(at + 2);
      // Start-of-frame markers carry the size (not DHT, JPG or DAC).
      if (
        marker >= 0xc0 &&
        marker <= 0xcf &&
        ![0xc4, 0xc8, 0xcc].includes(marker)
      )
        return ok({
          width: view.getUint16(at + 7),
          height: view.getUint16(at + 5),
        });
      at += 2 + length;
    }
  }
  return null;
}

/**
 * Size of the logo `/logo/<car>` serves for this car, when its brand's
 * metadata and the chosen image are already cached; null otherwise.
 */
export function cachedLogoSize(
  car: Pick<CarFile, "brand" | "year">,
  databaseDir: string,
): LogoSize | null {
  const dir = path.join(databaseDir, ".logos");
  try {
    const entry = JSON.parse(
      fs.readFileSync(brandMetadataFile(dir, car.brand), "utf8"),
    ) as { logos?: BrandLogo[] };
    if (!Array.isArray(entry.logos)) return null;
    const logo = pickLogo(entry.logos, car.year);
    if (!logo) return null;
    const base = logoImageBase(dir, logo.file);
    for (const ext of LOGO_EXTENSIONS) {
      let fd: number | undefined;
      try {
        fd = fs.openSync(/* turbopackIgnore: true */ `${base}.${ext}`, "r");
        const head = new Uint8Array(64 * 1024);
        const read = fs.readSync(fd, head, 0, head.length, 0);
        return imageSize(head.subarray(0, read));
      } catch {
        // try the next extension
      } finally {
        if (fd !== undefined) fs.closeSync(fd);
      }
    }
  } catch {
    // no metadata yet
  }
  return null;
}
