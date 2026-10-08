import { catalogErrorResponse, getCatalogEngines } from "@/lib/server/catalog";

export const dynamic = "force-dynamic";

/** `?brand=<id>&model=<id>&year=<n>` → engine versions registered that year. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  try {
    const engines = await getCatalogEngines(
      params.get("brand") ?? "",
      params.get("model") ?? "",
      Number(params.get("year")),
    );
    if (!engines)
      return Response.json(
        { error: "Nie znaleziono modelu." },
        { status: 404 },
      );
    return Response.json({ engines });
  } catch (err) {
    return catalogErrorResponse(err);
  }
}
