import { getCar, getSearchDocs } from "@/lib/content";

export const dynamic = "force-dynamic";

/** Search corpus of one car (`?car=<id>`), indexed in the browser. */
export function GET(request: Request) {
  const car = getCar(new URL(request.url).searchParams.get("car") ?? "");
  if (!car)
    return Response.json({ error: "Nie znaleziono auta." }, { status: 404 });
  return Response.json(getSearchDocs(car));
}
