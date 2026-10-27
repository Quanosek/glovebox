import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { OFFLINE_CACHE } from "@/lib/offline";
import { CACHE_PREFIX } from "@/lib/storage/schema";

type Event = {
  request?: Request;
  respondWith?: (value: Promise<Response>) => void;
  waitUntil: (value: Promise<unknown>) => void;
};

function worker() {
  const origin = "http://localhost:3000";
  const stores = new Map<string, Map<string, Response>>();
  let claimed = false;
  const handlers = new Map<string, (event: Event) => void>();
  const key = (value: Request | string) =>
    new URL(typeof value === "string" ? value : value.url, origin).href;
  const caches = {
    async keys() {
      return [...stores.keys()];
    },
    async delete(name: string) {
      return stores.delete(name);
    },
    async open(name: string) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      return {
        async match(request: Request | string) {
          return store.get(key(request))?.clone();
        },
        async put(request: Request | string, response: Response) {
          store.set(key(request), response);
        },
      };
    },
    async match(request: Request | string) {
      for (const store of stores.values()) {
        const response = store.get(key(request));
        if (response) return response.clone();
      }
    },
  };
  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    self: {
      location: { origin },
      clients: {
        claim: async () => {
          claimed = true;
        },
      },
      addEventListener: (name: string, handler: (event: Event) => void) =>
        handlers.set(name, handler),
    },
    caches,
    URL,
    Response,
    fetch: async () => {
      throw new Error("offline");
    },
  });
  return {
    async activate() {
      let activation: Promise<unknown> | undefined;
      handlers.get("activate")!({
        waitUntil: (value) => {
          activation = value;
        },
      });
      await activation;
      return { caches: await caches.keys(), claimed };
    },
    async seed(name: string, path: string, body: string) {
      await (await caches.open(name)).put(path, new Response(body));
    },
    async navigate(path: string) {
      const request = new Request(key(path));
      Object.defineProperty(request, "mode", { value: "navigate" });
      let response: Promise<Response> | undefined;
      handlers.get("fetch")!({
        request,
        respondWith: (value) => {
          response = value;
        },
        waitUntil: () => {},
      });
      if (!response) throw new Error("Request was not handled");
      return response;
    },
  };
}

describe("schema-compatible offline pages", () => {
  it("uses the Glovebox cache namespace", () => {
    expect(CACHE_PREFIX).toBe("glovebox-");
    expect(OFFLINE_CACHE).toBe("glovebox-offline-v1");
  });

  it("removes obsolete Glovebox caches but leaves other applications alone", async () => {
    const sw = worker();
    for (const name of [
      OFFLINE_CACHE,
      "glovebox-runtime-v1",
      "glovebox-offline-v0",
      "another-app",
    ])
      await sw.seed(name, "/", name);
    expect(await sw.activate()).toEqual({
      caches: [OFFLINE_CACHE, "glovebox-runtime-v1", "another-app"],
      claimed: true,
    });
  });

  it("serves the cache shared with the current client", async () => {
    const sw = worker();
    await sw.seed(OFFLINE_CACHE, "/auto/car/manual/intro", "current manual");
    expect(await (await sw.navigate("/auto/car/manual/intro")).text()).toBe(
      "current manual",
    );
  });
  it("does not serve an obsolete offline page that cannot read the current profile", async () => {
    const sw = worker();
    await sw.seed(
      "glovebox-offline-v0",
      "/auto/car/manual/intro",
      "obsolete manual",
    );
    const response = await sw.navigate("/auto/car/manual/intro");
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("obsolete manual");
  });
});
