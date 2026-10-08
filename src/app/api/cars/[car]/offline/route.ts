import { getCar, getCarUrls } from "@/lib/content";

export const dynamic = "force-dynamic";

/** URLs to store in the offline cache for one car (pages + images). */
export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/cars/[car]/offline">,
) {
  const car = getCar((await ctx.params).car);
  if (!car)
    return Response.json({ error: "Nie znaleziono auta." }, { status: 404 });
  return Response.json({
    urls: [...getCarUrls(car), `/api/search-index?car=${car.id}`],
  });
}
