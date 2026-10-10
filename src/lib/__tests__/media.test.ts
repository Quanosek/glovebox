import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET } from "@/app/media/[...path]/route";
import { createDatabase, type TestDatabase } from "./fixtures/database";

let db: TestDatabase;
let previous: string | undefined;

beforeAll(() => {
  previous = process.env.MANUALS_DATABASE_DIR;
  db = createDatabase();
  process.env.MANUALS_DATABASE_DIR = db.root;
  db.write("test-auto/assets/manual/drzwi/p005-01.webp", Buffer.from("RIFF"));
  db.write("test-auto/car.json", { id: "test-auto" });
  db.write("secret.webp", Buffer.from("secret"));
});

afterAll(() => {
  db.remove();
  if (previous === undefined) delete process.env.MANUALS_DATABASE_DIR;
  else process.env.MANUALS_DATABASE_DIR = previous;
});

const get = (...segments: string[]) =>
  GET(new Request("http://localhost/media"), {
    params: Promise.resolve({ path: segments }),
  } as Parameters<typeof GET>[1]);

describe("/media route", () => {
  it("serves illustrations of a car with a fixed type", async () => {
    const res = await get("test-auto", "manual", "drzwi", "p005-01.webp");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/webp");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await res.text()).toBe("RIFF");
  });

  it.each([
    ["path traversal", ["test-auto", "..", "..", "secret.webp"]],
    ["encoded traversal", ["test-auto", "manual", "..%2F..%2Fsecret.webp"]],
    ["file outside assets", ["test-auto", "car.json"]],
    ["unsupported type", ["test-auto", "manual", "car.json"]],
    ["invalid car id", ["Test_Auto", "manual", "drzwi", "p005-01.webp"]],
    ["missing file", ["test-auto", "manual", "drzwi", "p999-01.webp"]],
  ])("rejects %s", async (_label, segments) => {
    expect((await get(...segments)).status).toBe(404);
  });
});
