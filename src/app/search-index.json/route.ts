import { getSearchDocs } from "@/lib/content";

export const dynamic = "force-static";

/** Static search corpus consumed by the client-side search page. */
export function GET() {
  return Response.json(getSearchDocs());
}
