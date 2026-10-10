import fs from "node:fs/promises";
import path from "node:path";
import { getDatabaseDir } from "@/lib/content";
import { isValidId } from "@/lib/slug";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

const SEGMENT = /^[a-z0-9][a-z0-9._-]{0,120}$/i;

/** Serves `database/<car>/assets/<book>/…` as `/media/<car>/<book>/…`. */
export async function GET(
  _req: Request,
  ctx: RouteContext<"/media/[...path]">,
) {
  const [car, ...rest] = (await ctx.params).path;
  const type = TYPES[path.extname(rest.at(-1) ?? "").toLowerCase()];
  if (
    !isValidId(car) ||
    rest.length < 2 ||
    !type ||
    !rest.every((s) => SEGMENT.test(s) && !s.includes(".."))
  )
    return new Response("Not found", { status: 404 });
  // User data read at run time: not traced into the build output.
  const base = path.join(
    /* turbopackIgnore: true */ getDatabaseDir(),
    car,
    "assets",
  );
  const file = path.join(/* turbopackIgnore: true */ base, ...rest);
  if (!file.startsWith(base + path.sep))
    return new Response("Not found", { status: 404 });
  try {
    const data = await fs.readFile(file);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
