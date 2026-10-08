import { describe, expect, it } from "vitest";
import {
  InvalidDataError,
  UnsupportedVersionError,
  mergeData,
  migrate,
  parseImport,
} from "@/lib/storage/migrations";
import { SCHEMA_VERSION, STORAGE_KEY, createEmptyData, type Highlight } from "@/lib/storage/schema";
import { AppStore, type KeyValueStorage } from "@/lib/storage/store";

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

const highlight = (id: string, updatedAt = "2026-01-01T00:00:00.000Z"): Highlight => ({
  id,
  book: "manual",
  sectionId: "kluczyki/kluczyki-zamki",
  sectionTitle: "Kluczyki, zamki",
  href: "/instrukcja/kluczyki/kluczyki-zamki",
  anchor: { exact: "kluczyk", prefix: "", suffix: "", start: 0, end: 7 },
  color: "red",
  comment: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt,
});

describe("migrate", () => {
  it("returns empty data for missing storage", () => {
    expect(migrate(null)).toEqual(createEmptyData());
  });

  it("upgrades unversioned (v0) data", () => {
    const data = migrate({ highlights: { a: highlight("a") } });
    expect(data.version).toBe(SCHEMA_VERSION);
    expect(data.highlights.a.color).toBe("red");
  });

  it("runs migrations step by step", () => {
    const migrations = {
      0: (d: Record<string, unknown>) => ({ ...d, step0: true }),
      1: (d: Record<string, unknown>) => ({ ...d, notebook: { pages: [{ id: "p", title: "T", body: String(d.step0) }] } }),
    };
    const data = migrate({}, migrations, 2);
    expect(data.notebook.pages[0].body).toBe("true");
  });

  it("rejects data from a newer app version", () => {
    expect(() => migrate({ version: SCHEMA_VERSION + 1 })).toThrow(UnsupportedVersionError);
  });

  it("drops malformed entries and keeps valid ones", () => {
    const data = migrate({
      version: 1,
      highlights: { ok: highlight("ok"), bad: { book: "manual" }, wrongBook: { ...highlight("x"), book: "other" } },
      bookmarks: [{ book: "manual", sectionId: "a", title: "A", href: "/instrukcja/a" }, "junk"],
      settings: { fontSize: "huge", showUnavailable: true, vehicle: { "key.keyless": { status: "has", certainty: "confirmed" }, bad: { status: "maybe" } } },
    });
    expect(Object.keys(data.highlights)).toEqual(["ok"]);
    expect(data.bookmarks).toHaveLength(1);
    expect(data.bookmarks[0].id).toBe("manual:a");
    expect(data.settings.fontSize).toBe("normal");
    expect(data.settings.showUnavailable).toBe(true);
    expect(data.settings.vehicle).toEqual({ "key.keyless": { status: "has", certainty: "confirmed" } });
  });
});

describe("parseImport / mergeData", () => {
  it("accepts export files and rejects foreign files", () => {
    const data = createEmptyData();
    data.highlights.a = highlight("a");
    const file = JSON.stringify({ app: "opel-cascada-manual", exportedAt: "x", data });
    expect(parseImport(file).highlights.a.id).toBe("a");
    expect(() => parseImport(JSON.stringify({ app: "other", data }))).toThrow(InvalidDataError);
    expect(() => parseImport("{not json")).toThrow(InvalidDataError);
  });

  it("merges by id, newest wins", () => {
    const a = createEmptyData();
    a.highlights.x = highlight("x", "2026-01-01T00:00:00.000Z");
    a.notebook.pages = [{ id: "n1", title: "A", body: "old", createdAt: "1", updatedAt: "2026-01-01" }];
    const b = createEmptyData();
    b.highlights.x = { ...highlight("x", "2026-02-01T00:00:00.000Z"), comment: "nowszy" };
    b.highlights.y = highlight("y");
    b.notebook.pages = [
      { id: "n1", title: "A", body: "new", createdAt: "1", updatedAt: "2026-02-01" },
      { id: "n2", title: "B", body: "", createdAt: "1", updatedAt: "2026-01-01" },
    ];
    const merged = mergeData(a, b);
    expect(merged.highlights.x.comment).toBe("nowszy");
    expect(Object.keys(merged.highlights).sort()).toEqual(["x", "y"]);
    expect(merged.notebook.pages.map((p) => p.body)).toEqual(["new", ""]);
  });
});

describe("AppStore", () => {
  it("persists updates and notifies subscribers", () => {
    const storage = memoryStorage();
    const store = new AppStore(storage);
    let calls = 0;
    store.subscribe(() => calls++);
    const before = store.get();
    store.update((d) => ({ ...d, highlights: { ...d.highlights, a: highlight("a") } }));
    expect(calls).toBe(1);
    expect(store.get()).not.toBe(before);
    expect(JSON.parse(storage.data[STORAGE_KEY]).highlights.a.id).toBe("a");
    expect(new AppStore(storage).get().highlights.a.id).toBe("a");
  });

  it("backs up unreadable data instead of losing it", () => {
    const storage = memoryStorage({ [STORAGE_KEY]: "{broken" });
    const store = new AppStore(storage);
    expect(store.get()).toEqual(createEmptyData());
    expect(Object.keys(storage.data).some((k) => k.startsWith(`${STORAGE_KEY}:backup-`))).toBe(true);
    expect(store.lastError).toBeTruthy();
  });

  it("exports, imports and clears", () => {
    const store = new AppStore(memoryStorage());
    store.update((d) => ({ ...d, highlights: { a: highlight("a") } }));
    const json = store.exportJson();
    store.clear();
    expect(store.get().highlights).toEqual({});
    store.importJson(json, "replace");
    expect(store.get().highlights.a.id).toBe("a");
    const other = createEmptyData();
    other.highlights.b = highlight("b");
    store.importJson(JSON.stringify(other), "merge");
    expect(Object.keys(store.get().highlights).sort()).toEqual(["a", "b"]);
  });
});
