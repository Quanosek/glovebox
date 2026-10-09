import { describe, expect, it } from "vitest";
import {
  InvalidDataError,
  UnsupportedVersionError,
  mergeData,
  migrate,
  parseImport,
} from "@/lib/storage/migrations";
import {
  SCHEMA_VERSION,
  STORAGE_KEY,
  createEmptyData,
  type Highlight,
} from "@/lib/storage/schema";
import { AppStore, type KeyValueStorage } from "@/lib/storage/store";

function memoryStorage(
  initial: Record<string, string> = {},
): KeyValueStorage & { data: Record<string, string> } {
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

const highlight = (
  id: string,
  updatedAt = "2026-01-01T00:00:00.000Z",
): Highlight => ({
  id,
  car: "opel-cascada-2016",
  book: "manual",
  sectionId: "kluczyki/kluczyki-zamki",
  sectionTitle: "Kluczyki, zamki",
  href: "/auto/opel-cascada-2016/instrukcja/kluczyki/kluczyki-zamki",
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
      1: (d: Record<string, unknown>) => ({
        ...d,
        notebook: { pages: [{ id: "p", title: "T", body: String(d.step0) }] },
      }),
    };
    const data = migrate({}, migrations, 2);
    expect(data.notebook.pages[0].body).toBe("true");
  });

  it("moves v1 (single car) data to the Cascada car", () => {
    const { car: _car, ...v1 } = highlight("a");
    void _car;
    const data = migrate({
      version: 1,
      highlights: {
        a: { ...v1, href: "/navi-950/radio#b3" },
      },
      lastRead: {
        book: "manual",
        sectionId: "x",
        title: "X",
        href: "/instrukcja/x",
        scrollY: 10,
        at: "2026-01-01T00:00:00.000Z",
      },
      settings: { fontSize: "large" },
    });
    expect(data.highlights.a.car).toBe("opel-cascada-2016");
    expect(data.highlights.a.href).toBe(
      "/auto/opel-cascada-2016/navi-950/radio#b3",
    );
    expect(data.lastRead?.car).toBe("opel-cascada-2016");
    expect(data.lastRead?.href).toBe("/auto/opel-cascada-2016/instrukcja/x");
    expect(data.settings.activeCar).toBe("opel-cascada-2016");
    expect(data.settings.fontSize).toBe("large");
  });

  it("leaves no active car for empty v1 data", () => {
    expect(migrate({ version: 1 }).settings.activeCar).toBeNull();
  });

  it("validates settings of the current version", () => {
    const data = migrate({
      version: SCHEMA_VERSION,
      settings: { activeCar: "../x", profileName: "Jan" },
    });
    expect(data.settings.activeCar).toBeNull();
    expect(data.settings.profileName).toBe("Jan");
  });

  it("rejects data from a newer app version", () => {
    expect(() => migrate({ version: SCHEMA_VERSION + 1 })).toThrow(
      UnsupportedVersionError,
    );
  });

  it("drops malformed entries and keeps valid ones", () => {
    const data = migrate({
      version: 1,
      highlights: {
        ok: highlight("ok"),
        bad: { book: "manual" },
        wrongBook: { ...highlight("x"), book: "../etc" },
      },
      bookmarks: [
        { book: "manual", sectionId: "a", title: "A", href: "/instrukcja/a" },
        "junk",
      ],
      settings: {
        fontSize: "huge",
        showUnavailable: true,
        vehicle: {
          "key.keyless": { status: "has", certainty: "confirmed" },
          "infotainment.infinity": { status: "no", certainty: "confirmed" },
          "engine.petrol16Turbo": { status: "has", certainty: "confirmed" },
          bad: { status: "maybe" },
        },
      },
    });
    expect(Object.keys(data.highlights)).toEqual(["ok"]);
    expect(data.bookmarks).toHaveLength(1);
    expect(data.bookmarks[0].id).toBe("opel-cascada-2016:manual:a");
    expect(data.bookmarks[0].href).toBe("/auto/opel-cascada-2016/instrukcja/a");
    expect(data.settings.fontSize).toBe("normal");
    expect(data.settings.showUnavailable).toBe(true);
    expect(data.settings.vehicles).toEqual({
      "opel-cascada-2016": {
        "key.keyless": { status: "has", certainty: "confirmed" },
        "infotainment.premiumAudio": { status: "no", certainty: "confirmed" },
      },
    });
    expect("vehicle" in data.settings).toBe(false);
  });

  it("keeps equipment of every car in v3 data", () => {
    const data = migrate({
      version: SCHEMA_VERSION,
      settings: {
        vehicles: {
          "skoda-octavia-2019": {
            "drive.towbar": { status: "has", certainty: "confirmed" },
            "made.up": { status: "has", certainty: "confirmed" },
          },
          "../x": { "drive.towbar": { status: "has", certainty: "confirmed" } },
          empty: {},
        },
      },
    });

    expect(data.settings.vehicles).toEqual({
      "skoda-octavia-2019": {
        "drive.towbar": { status: "has", certainty: "confirmed" },
      },
    });
  });

  it("migrates only cars already used by the local profile into owned cars", () => {
    const data = migrate({
      version: 3,
      settings: {
        activeCar: "skoda-octavia-2019",
        vehicles: {
          "mazda-3-2020": {
            "drive.towbar": { status: "has", certainty: "confirmed" },
          },
        },
      },
      bookmarks: [{ car: "volvo-v60-2021", book: "manual", sectionId: "x" }],
      highlights: { invalid: { car: "../unsafe" } },
    });
    expect(data.settings.ownedCars).toEqual([
      "skoda-octavia-2019",
      "mazda-3-2020",
      "volvo-v60-2021",
    ]);
  });

  it("sanitizes owned cars and keeps an empty list by default", () => {
    expect(createEmptyData().settings.ownedCars).toEqual([]);
    const data = migrate({
      version: SCHEMA_VERSION,
      settings: {
        ownedCars: ["skoda-octavia-2019", "../unsafe", "skoda-octavia-2019"],
      },
    });
    expect(data.settings.ownedCars).toEqual(["skoda-octavia-2019"]);
  });
});

describe("schema v5", () => {
  const car = "skoda-octavia-2019";
  const entry = (sectionId: string, at: string) => ({
    car,
    book: "manual",
    sectionId,
    title: sectionId,
    href: `/auto/${car}/manual/${sectionId}`,
    thumb: null,
    at,
  });

  it("seeds the reading history from the last read section", () => {
    const lastRead = { ...entry("a", "2026-01-02T00:00:00.000Z"), scrollY: 5 };
    const data = migrate({ version: 4, lastRead, settings: {} });
    expect(data.version).toBe(SCHEMA_VERSION);
    expect(data.history).toEqual([
      { ...entry("a", "2026-01-02T00:00:00.000Z") },
    ]);
    expect(data.reminders).toEqual([]);
    expect(data.settings.favorites).toEqual({});
  });

  it("sanitizes history, reminders and favourites", () => {
    const bookmark = {
      id: `${car}:manual:a`,
      car,
      book: "manual",
      sectionId: "a",
      title: "A",
      href: `/auto/${car}/manual/a`,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const data = migrate({
      version: SCHEMA_VERSION,
      bookmarks: [bookmark],
      history: [
        entry("a", "2026-01-01T00:00:00.000Z"),
        entry("a", "2026-01-03T00:00:00.000Z"),
        { ...entry("b", "2026-01-02T00:00:00.000Z"), href: "https://x.pl" },
        { ...entry("c", "2026-01-02T00:00:00.000Z"), thumb: "javascript:x" },
      ],
      reminders: [
        {
          id: "r1",
          car,
          title: "Przegląd",
          dueDate: "2026-05-01",
          dueKm: 120000,
          done: false,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        { id: "r2", car, title: "" },
        { id: "r3", car, title: "Zła data", dueDate: "01.05.2026" },
      ],
      settings: {
        favorites: {
          [car]: [bookmark.id, `${car}:manual:missing`],
          "../x": [bookmark.id],
        },
      },
    });
    expect(data.history.map((h) => [h.sectionId, h.at, h.thumb])).toEqual([
      ["a", "2026-01-03T00:00:00.000Z", null],
      ["c", "2026-01-02T00:00:00.000Z", null],
    ]);
    expect(data.reminders.map((r) => r.id)).toEqual(["r1", "r3"]);
    expect(data.reminders.map((r) => r.kind)).toEqual(["custom", "custom"]);
    expect(data.reminders[1].dueDate).toBeNull();
    expect(data.settings.favorites).toEqual({ [car]: [bookmark.id] });
  });

  it("keeps one inspection and one OC reminder per car", () => {
    const data = migrate({
      version: SCHEMA_VERSION,
      reminders: [
        { id: "a", car, kind: "inspection", title: "Badanie techniczne" },
        { id: "b", car, kind: "inspection", title: "Badanie techniczne" },
        { id: "c", car, kind: "insurance", title: "Ubezpieczenie OC" },
        { id: "d", car, kind: "weird", title: "Własne" },
      ],
    });
    expect(data.reminders.map((r) => [r.id, r.kind])).toEqual([
      [`inspection:${car}`, "inspection"],
      [`insurance:${car}`, "insurance"],
      ["d", "custom"],
    ]);
  });

  it("merges history and reminders, newest wins", () => {
    const current = createEmptyData();
    current.history = [entry("a", "2026-01-01T00:00:00.000Z")];
    const incoming = createEmptyData();
    incoming.history = [
      entry("a", "2026-01-05T00:00:00.000Z"),
      entry("b", "2026-01-02T00:00:00.000Z"),
    ];
    incoming.reminders = [
      {
        id: "r1",
        car,
        kind: "custom",
        title: "Olej",
        dueDate: null,
        dueKm: 30000,
        done: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ];
    const merged = mergeData(current, incoming);
    expect(merged.history.map((h) => [h.sectionId, h.at])).toEqual([
      ["a", "2026-01-05T00:00:00.000Z"],
      ["b", "2026-01-02T00:00:00.000Z"],
    ]);
    expect(merged.reminders).toHaveLength(1);
  });
});

describe("parseImport / mergeData", () => {
  it("accepts export files and rejects foreign files", () => {
    const data = createEmptyData();
    data.highlights.a = highlight("a");
    const file = JSON.stringify({
      app: "opel-cascada-manual",
      exportedAt: "x",
      data,
    });
    expect(parseImport(file).highlights.a.id).toBe("a");
    expect(() => parseImport(JSON.stringify({ app: "other", data }))).toThrow(
      InvalidDataError,
    );
    expect(() => parseImport("{not json")).toThrow(InvalidDataError);
  });

  it("merges by id, newest wins", () => {
    const a = createEmptyData();
    a.highlights.x = highlight("x", "2026-01-01T00:00:00.000Z");
    a.notebook.pages = [
      {
        id: "n1",
        title: "A",
        body: "old",
        createdAt: "1",
        updatedAt: "2026-01-01",
      },
    ];
    const b = createEmptyData();
    b.highlights.x = {
      ...highlight("x", "2026-02-01T00:00:00.000Z"),
      comment: "nowszy",
    };
    b.highlights.y = highlight("y");
    b.notebook.pages = [
      {
        id: "n1",
        title: "A",
        body: "new",
        createdAt: "1",
        updatedAt: "2026-02-01",
      },
      {
        id: "n2",
        title: "B",
        body: "",
        createdAt: "1",
        updatedAt: "2026-01-01",
      },
    ];
    a.settings.vehicles = {
      car1: { "drive.towbar": { status: "has", certainty: "confirmed" } },
    };
    a.settings.ownedCars = ["car1"];
    b.settings.vehicles = {
      car1: {
        "drive.towbar": { status: "no", certainty: "confirmed" },
        "access.alarm": { status: "has", certainty: "confirmed" },
      },
      car2: { "drive.towbar": { status: "no", certainty: "confirmed" } },
    };
    b.settings.ownedCars = ["car2"];
    const merged = mergeData(a, b);
    expect(merged.settings.vehicles.car1["drive.towbar"].status).toBe("has");
    expect(merged.settings.vehicles.car1["access.alarm"].status).toBe("has");
    expect(merged.settings.vehicles.car2["drive.towbar"].status).toBe("no");
    expect(merged.settings.ownedCars).toEqual(["car1", "car2"]);
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
    store.update((d) => ({
      ...d,
      highlights: { ...d.highlights, a: highlight("a") },
    }));
    expect(calls).toBe(1);
    expect(store.get()).not.toBe(before);
    expect(JSON.parse(storage.data[STORAGE_KEY]).highlights.a.id).toBe("a");
    expect(new AppStore(storage).get().highlights.a.id).toBe("a");
  });

  it("backs up unreadable data instead of losing it", () => {
    const storage = memoryStorage({ [STORAGE_KEY]: "{broken" });
    const store = new AppStore(storage);
    expect(store.get()).toEqual(createEmptyData());
    expect(
      Object.keys(storage.data).some((k) =>
        k.startsWith(`${STORAGE_KEY}:backup-`),
      ),
    ).toBe(true);
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
