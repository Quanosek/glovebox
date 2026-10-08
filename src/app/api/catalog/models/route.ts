import { catalogErrorResponse, getCatalogModels } from "@/lib/server/catalog";

export const dynamic = "force-dynamic";

/** `?brand=<id>` → models of the brand with the years they were sold. */
export async function GET(request: Request) {
  const brand = new URL(request.url).searchParams.get("brand") ?? "";
  try {
    const models = await getCatalogModels(brand);
    if (!models)
      return Response.json({ error: "Nie znaleziono marki." }, { status: 404 });
    return Response.json({ models });
  } catch (err) {
    return catalogErrorResponse(err);
  }
}
