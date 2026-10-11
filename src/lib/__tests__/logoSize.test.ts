import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";
import {
  brandMetadataFile,
  cachedLogoSize,
  imageSize,
  logoImageBase,
} from "@/lib/server/logoSize";

const image = (format: "png" | "jpeg" | "webp" | "gif") =>
  sharp({
    create: {
      width: 123,
      height: 45,
      channels: 4,
      background: { r: 200, g: 16, b: 46, alpha: 1 },
    },
  })
    .toFormat(format)
    .toBuffer();

let root: string | undefined;
afterEach(() => {
  if (root) fs.rmSync(root, { recursive: true, force: true });
  root = undefined;
});

describe("logo size", () => {
  it.each(["png", "jpeg", "webp", "gif"] as const)(
    "reads the size of a %s logo from its header",
    async (format) => {
      expect(imageSize(new Uint8Array(await image(format)))).toEqual({
        width: 123,
        height: 45,
      });
    },
  );

  it("ignores data that is not an image", () => {
    expect(imageSize(new TextEncoder().encode("<svg></svg>"))).toBeNull();
  });

  it("gives the size of the cached logo of the car's model year", async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "glovebox-logo-size-"));
    const dir = path.join(root, ".logos");
    fs.mkdirSync(dir);
    const car = { brand: "Opel", year: 2016 };
    expect(cachedLogoSize(car, root)).toBeNull();
    fs.writeFileSync(
      brandMetadataFile(dir, "Opel"),
      JSON.stringify({
        logos: [
          { file: "Old.svg", rank: "normal", start: 2009, end: 2017 },
          { file: "New.svg", rank: "preferred", start: 2023 },
        ],
      }),
    );
    // Metadata alone: the image has not been downloaded yet.
    expect(cachedLogoSize(car, root)).toBeNull();
    fs.writeFileSync(
      `${logoImageBase(dir, "Old.svg")}.png`,
      await image("png"),
    );
    expect(cachedLogoSize(car, root)).toEqual({ width: 123, height: 45 });
    expect(cachedLogoSize({ brand: "Opel", year: 2024 }, root)).toBeNull();
  });
});
