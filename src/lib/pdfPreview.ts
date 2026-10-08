/**
 * Renders the first page of a PDF to a small PNG in the browser (pdf.js).
 * Used only for previews in the "Dodaj auto" wizard; the PDF never leaves
 * the machine except for the upload to the local server.
 */
export interface PdfPreview {
  pages: number;
  /** Object URL of the rendered first page; revoke when no longer needed. */
  url: string;
}

const PREVIEW_WIDTH = 320;

export async function renderPdfPreview(file: File): Promise<PdfPreview> {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
  }
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data });
  const doc = await task.promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: PREVIEW_WIDTH / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, viewport }).promise;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) throw new Error("canvas.toBlob failed");
    return { pages: doc.numPages, url: URL.createObjectURL(blob) };
  } finally {
    await task.destroy();
  }
}
