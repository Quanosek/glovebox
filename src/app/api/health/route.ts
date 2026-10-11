import { APP_VERSION } from "@/lib/brand";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok", version: APP_VERSION });
}
