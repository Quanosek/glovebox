import { getCar, getFeatureSections } from "@/lib/content";

export const dynamic = "force-dynamic";

/**
 * Optional equipment described in the manuals of one car: feature id →
 * sections whose title mentions it, plus the engine chosen from the official
 * catalogue (for suggestions). Used by the equipment step of the wizard.
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
    spec: car.spec ?? null,
  });
}
