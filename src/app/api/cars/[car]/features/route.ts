import { getCar, getFeatureSections } from "@/lib/content";
import { getManualEngines } from "@/lib/carOverview";

export const dynamic = "force-dynamic";

/**
 * Optional equipment described in the manuals of one car: feature id →
 * sections whose title mentions it, plus engine variants printed in the manuals.
 */
export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/cars/[car]/features">,
) {
  const car = getCar((await ctx.params).car);
  if (!car)
    return Response.json({ error: "Nie znaleziono auta." }, { status: 404 });
  return Response.json({
    sections: getFeatureSections(car),
    engines: getManualEngines(car),
    catalog: car.catalog,
    year: car.year,
  });
}
