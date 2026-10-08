import { catalogErrorResponse, getCatalogBrands } from "@/lib/server/catalog";

export const dynamic = "force-dynamic";

/** Brands from the official registration catalogues (docs/catalog.md). */
export async function GET() {
  try {
    return Response.json({ brands: await getCatalogBrands() });
  } catch (err) {
    return catalogErrorResponse(err);
  }
}
