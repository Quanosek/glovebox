import { getCar } from "@/lib/content";
import { getCarLogo } from "@/lib/server/logos";

export const dynamic = "force-dynamic";

/** Brand logo of one car (docs/logos.md); 404 lets the page show the app icon. */
export async function GET(_req: Request, ctx: RouteContext<"/logo/[car]">) {
  const car = getCar((await ctx.params).car);
  const logo = car ? await getCarLogo(car) : null;
  if (!logo) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(logo.data), {
    headers: {
      "Content-Type": logo.type,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
