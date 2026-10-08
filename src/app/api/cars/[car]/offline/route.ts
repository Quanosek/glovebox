import { getCar, getCarUrls, getCarVersion } from "@/lib/content";

export const dynamic = "force-dynamic";

/**
 * URLs to store in the offline cache for one car (pages, images, search
 * index) plus a version string that changes whenever that content does.
 */
export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/cars/[car]/offline">,
) {
  const car = getCar((await ctx.params).car);
  if (!car)
    return Response.json({ error: "Nie znaleziono auta." }, { status: 404 });
  return Response.json({
    version: getCarVersion(car),
    urls: [...getCarUrls(car), `/api/search-index?car=${car.id}`],
  });
}
