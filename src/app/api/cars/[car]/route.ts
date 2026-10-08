import { getCar, getCarSummary } from "@/lib/content";
import { rejectCrossSite } from "@/lib/server/guard";
import { ImportError, deleteCar } from "@/lib/server/importer";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/cars/[car]">) {
  const car = getCar((await ctx.params).car);
  if (!car)
    return Response.json({ error: "Nie znaleziono auta." }, { status: 404 });
  return Response.json({ car: getCarSummary(car) });
}

export async function DELETE(
  request: Request,
  ctx: RouteContext<"/api/cars/[car]">,
) {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;
  try {
    await deleteCar((await ctx.params).car);
    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof ImportError)
      return Response.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
