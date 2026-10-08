/**
 * Rejects cross-site requests to the mutating API routes, so that a web page
 * opened in another tab cannot upload or delete data on the local server.
 */
export function rejectCrossSite(request: Request): Response | null {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return forbidden();
  const origin = request.headers.get("origin");
  if (origin) {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return forbidden();
    }
    const host = request.headers.get("host");
    if (!host || originHost !== host) return forbidden();
  }
  return null;
}

function forbidden() {
  return Response.json(
    { error: "Żądanie spoza aplikacji zostało odrzucone." },
    { status: 403 },
  );
}
