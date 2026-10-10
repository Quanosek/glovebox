import { listCarSummaries } from "@/lib/content";
import { rejectCrossSite } from "@/lib/server/guard";
import { ImportError, startImport } from "@/lib/server/importer";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ cars: listCarSummaries() });
}

/**
 * Starts importing a new car. Multipart form fields: `source` (`catalog` or
 * `other`), `brand`, `model`, `year`, optional `variant` (`other` only), and repeated `files` (PDF)
 * with matching repeated `titles`. For `catalog`, brand and model are
 * catalogue ids.
 */
export async function POST(request: Request) {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json(
      { error: "Nie udało się odczytać przesłanych plików." },
      { status: 400 },
    );
  }
  const files = form
    .getAll("files")
    .filter((f): f is File => f instanceof File);
  const titles = form.getAll("titles").map(String);
  try {
    const source = form.get("source") === "catalog" ? "catalog" : "other";
    const job = await startImport({
      source,
      brand: String(form.get("brand") ?? ""),
      model: String(form.get("model") ?? ""),
      year: Number(form.get("year")),
      variant:
        source === "other" && form.get("variant")
          ? String(form.get("variant"))
          : undefined,
      docs: files.map((file, i) => ({ file, title: titles[i] ?? "" })),
    });
    return Response.json({ job }, { status: 202 });
  } catch (err) {
    if (err instanceof ImportError)
      return Response.json({ error: err.message }, { status: err.status });
    console.error(err);
    return Response.json(
      { error: "Nie udało się zapisać instrukcji. Spróbuj ponownie." },
      { status: 500 },
    );
  }
}
