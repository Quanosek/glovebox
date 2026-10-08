import { logoHref } from "@/lib/cars";
import { getCar, getCarUrls, getCarVersion } from "@/lib/content";
import { getCarLogo } from "@/lib/server/logos";

export const dynamic = "force-dynamic";

/**
 * URLs to store in the offline cache for one car (pages, images, search
 * index, brand logo when one is known) plus a version string that changes
 * whenever that content does.
 */
export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/cars/[car]/offline">,
) {
  const car = getCar((await ctx.params).car);
  if (!car)
    return Response.json({ error: "Nie znaleziono auta." }, { status: 404 });
  // Resolved here so a missing logo is never queued (it would count as failed).
  const logo = (await getCarLogo(car)) ? [logoHref(car.id)] : [];
  return Response.json({
    version: getCarVersion(car),
    urls: [...getCarUrls(car), `/api/search-index?car=${car.id}`, ...logo],
  });
}
