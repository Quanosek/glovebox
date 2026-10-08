import { getJob } from "@/lib/server/importer";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/jobs/[id]">) {
  const job = getJob((await ctx.params).id);
  if (!job)
    return Response.json(
      { error: "Nie znaleziono zadania (serwer mógł zostać zrestartowany)." },
      { status: 404 },
    );
  return Response.json({ job });
}
