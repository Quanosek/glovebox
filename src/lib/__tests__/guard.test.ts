import { afterEach, describe, expect, it } from "vitest";
import { isLoopbackHost, rejectCrossSite } from "@/lib/server/guard";

const req = (headers: Record<string, string>) =>
  new Request("http://localhost:3000/api/cars", { method: "POST", headers });

describe("rejectCrossSite", () => {
  afterEach(() => {
    delete process.env.MANUALS_ALLOW_REMOTE_IMPORT;
  });

  it("accepts same-origin browser requests on loopback", () => {
    expect(
      rejectCrossSite(
        req({
          host: "localhost:3000",
          origin: "http://localhost:3000",
          "sec-fetch-site": "same-origin",
        }),
      ),
    ).toBeNull();
    expect(
      rejectCrossSite(
        req({ host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" }),
      ),
    ).toBeNull();
  });

  it("rejects requests without Origin or Sec-Fetch-Site", () => {
    expect(rejectCrossSite(req({ host: "localhost:3000" }))?.status).toBe(403);
  });

  it("rejects cross-site and mismatched origins", () => {
    expect(
      rejectCrossSite(
        req({
          host: "localhost:3000",
          origin: "http://evil.example",
          "sec-fetch-site": "cross-site",
        }),
      )?.status,
    ).toBe(403);
    expect(
      rejectCrossSite(
        req({ host: "localhost:3000", origin: "http://localhost:4000" }),
      )?.status,
    ).toBe(403);
  });

  it("rejects non-loopback hosts unless remote import is enabled", () => {
    const lan = req({
      host: "192.168.1.5:3000",
      origin: "http://192.168.1.5:3000",
    });
    expect(rejectCrossSite(lan)?.status).toBe(403);
    process.env.MANUALS_ALLOW_REMOTE_IMPORT = "1";
    expect(rejectCrossSite(lan)).toBeNull();
  });
});

describe("isLoopbackHost", () => {
  it.each([
    ["localhost", true],
    ["localhost:3000", true],
    ["127.0.0.1:8080", true],
    ["[::1]:3000", true],
    ["evil.example", false],
    ["127.0.0.1.evil.example", false],
    ["10.0.0.2:3000", false],
  ])("%s -> %s", (host, expected) => {
    expect(isLoopbackHost(host)).toBe(expected);
  });
});

describe("mutating API routes", () => {
  const routes = import.meta.glob<Record<string, unknown>>(
    "/src/app/api/**/route.ts",
  );
  const crossSite = (method: string) =>
    new Request("http://localhost:3000/api/x", {
      method,
      headers: {
        host: "localhost:3000",
        origin: "https://example.com",
        "sec-fetch-site": "cross-site",
      },
    });

  it("reject cross-site requests before doing anything", async () => {
    let checked = 0;
    for (const load of Object.values(routes)) {
      const route = await load();
      for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
        const handler = route[method];
        if (typeof handler !== "function") continue;
        const ctx = { params: Promise.resolve({ car: "test-auto", id: "x" }) };
        const res = (await handler(crossSite(method), ctx)) as Response;
        expect(res.status, method).toBe(403);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("rejects cross-site saved-manual reuse and reorder without reading the body", async () => {
    const { POST } = await import("@/app/api/cars/route");
    const form = new FormData();
    form.set("existingCar", "saved");
    form.append("bookOrder", "manual");
    const request = new Request("http://localhost:3000/api/cars", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "https://example.com",
        "sec-fetch-site": "cross-site",
      },
      body: form,
    });
    expect((await POST(request)).status).toBe(403);
    expect(request.bodyUsed).toBe(false);
  });
});
