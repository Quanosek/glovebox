/**
 * Protects the mutating API routes (import, delete) of the unauthenticated
 * local server:
 *
 * - the request must come from a page of this app (`Origin` matching `Host`
 *   or `Sec-Fetch-Site: same-origin`); requests without either header
 *   (scripts, other tools) are rejected;
 * - the `Host` must be a loopback name, which blocks other devices on the
 *   network and DNS-rebinding pages. Set `MANUALS_ALLOW_REMOTE_IMPORT=1` to
 *   allow adding/deleting cars from other devices on a trusted network.
 */
export function rejectCrossSite(request: Request): Response | null {
  const host = request.headers.get("host");
  if (!host) return forbidden();
  if (process.env.MANUALS_ALLOW_REMOTE_IMPORT !== "1" && !isLoopbackHost(host))
    return forbidden(
      "Dodawanie i usuwanie aut jest dostępne tylko na komputerze, na którym działa aplikacja.",
    );

  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return forbidden();
  const origin = request.headers.get("origin");
  if (origin) {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return forbidden();
    }
    if (originHost !== host) return forbidden();
  } else if (site !== "same-origin") {
    return forbidden();
  }
  return null;
}

/** `localhost`, `127.x.x.x` or `[::1]`, with an optional port. */
export function isLoopbackHost(host: string): boolean {
  const name = host
    .replace(/:\d+$/, "")
    .replace(/^\[(.*)\]$/, "$1")
    .toLowerCase();
  return (
    name === "localhost" ||
    name.endsWith(".localhost") ||
    name === "::1" ||
    /^127(\.\d{1,3}){3}$/.test(name)
  );
}

function forbidden(message = "Żądanie spoza aplikacji zostało odrzucone.") {
  return Response.json({ error: message }, { status: 403 });
}
