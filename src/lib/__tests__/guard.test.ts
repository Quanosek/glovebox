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
