import { describe, expect, it } from "vitest";
import {
  InvalidDataError,
  UnsupportedVersionError,
  mergeData,
  parseData,
  parseImport,
} from "@/lib/storage/data";
import {
  EXPORT_APP_ID,
  SCHEMA_VERSION,
  STORAGE_KEY,
  createEmptyData,
  type Highlight,
} from "@/lib/storage/schema";
import { AppStore, getStore, type KeyValueStorage } from "@/lib/storage/store";
import {
  addOwnedCar,
  setCarEngine,
  setFeatureState,
} from "@/lib/storage/hooks";
import { withExclusiveFeatures } from "@/config/vehicle";

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
  car: "car",
  book: "manual",
  sectionId: "kluczyki/kluczyki-zamki",
  sectionTitle: "Kluczyki, zamki",
  href: "/auto/car/manual/kluczyki/kluczyki-zamki",
  anchor: { exact: "kluczyk", prefix: "", suffix: "", start: 0, end: 7 },
  color: "red",
  comment: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt,
});

const engine = {
  fuel: "diesel" as const,
  engineCm3: 1956,
  powerKw: 125,
  label: "2.0 Diesel",
  code: "D20",
};

describe("Glovebox schema", () => {
  it("starts at version 1 with its own storage and export identity", () => {
    expect(SCHEMA_VERSION).toBe(1);
    expect(STORAGE_KEY).toBe("glovebox");
    expect(EXPORT_APP_ID).toBe("glovebox");
    expect(parseData(createEmptyData())).toEqual(createEmptyData());
  });

  it.each([null, [], "data", {}, { version: "1" }, { version: 1.5 }])(
    "rejects invalid or unversioned data: %j",
    (data) => {
      expect(() => parseData(data)).toThrow(InvalidDataError);
    },
  );

  it.each([0, 2, 7])(
    "rejects unsupported schema %s without migrating it",
    (version) => {
      expect(() => parseData({ version })).toThrow(UnsupportedVersionError);
    },
  );

  it("stores owner choices but not inferred exclusions, and allows switching alternatives", () => {
    const store = getStore();
    store.replace(createEmptyData());
    setFeatureState("car", "transmission.automatic", {
      status: "has",
      certainty: "confirmed",
    });
    expect(
      store.get().settings.vehicles.car["transmission.manual"],
    ).toBeUndefined();
    expect(
      withExclusiveFeatures(store.get().settings.vehicles.car)[
        "transmission.manual"
      ],
    ).toEqual({ status: "no", certainty: "probable" });
    setFeatureState("car", "transmission.manual", {
      status: "has",
      certainty: "confirmed",
    });
    expect(
      store.get().settings.vehicles.car["transmission.automatic"],
    ).toBeUndefined();
    setCarEngine("car", null);
    expect(
      withExclusiveFeatures(store.get().settings.vehicles.car)[
        "transmission.automatic"
      ]?.status,
    ).toBe("no");
    setFeatureState("car", "transmission.manual", null);
    expect(
      withExclusiveFeatures(store.get().settings.vehicles.car ?? {})[
        "transmission.automatic"
      ],
    ).toBeUndefined();
  });

  it("assigns a library car with an unknown engine and preserves a local choice", () => {
    const store = getStore();
    store.replace(createEmptyData());
    addOwnedCar("car");
    expect(store.get().settings.engines.car).toBeNull();
    setCarEngine("car", engine);
    addOwnedCar("car");
    expect(store.get().settings.engines.car).toEqual(engine);
    expect(store.get().settings.vehicles.car["engine.diesel"].status).toBe(
      "has",
    );
    setFeatureState("car", "engine.diesel", null);
    expect(store.get().settings.vehicles.car["engine.diesel"]).toBeUndefined();
    setCarEngine("car", null);
    expect(store.get().settings.engines.car).toBeNull();
  });

  it("keeps valid engines and explicit unknown choices, drops malformed entries", () => {
    const data = parseData({
      version: SCHEMA_VERSION,
      settings: {
        engines: {
          car: engine,
          unknown: null,
          invalid: { ...engine, powerKw: -1 },
          "../bad": engine,
        },
      },
    });
    expect(data.settings.engines).toEqual({ car: engine, unknown: null });
    expect(
      parseImport(JSON.stringify({ app: EXPORT_APP_ID, data })).settings
        .engines,
    ).toEqual(data.settings.engines);
  });

  it("merges local engines with current choices including unknown winning", () => {
    const current = createEmptyData();
    const incoming = createEmptyData();
    current.settings.engines.car = null;
    incoming.settings.engines = { car: engine, other: engine };
    expect(mergeData(current, incoming).settings.engines).toEqual({
      car: null,
      other: engine,
    });
  });

  it("validates settings of the current version", () => {
    const data = parseData({
      version: SCHEMA_VERSION,
      settings: { activeCar: "../x", profileName: "Jan" },
    });
    expect(data.settings.activeCar).toBeNull();
    expect(data.settings.profileName).toBe("Jan");
  });

  it("drops malformed entries and keeps valid ones without rewriting old shapes", () => {
    const data = parseData({
      version: SCHEMA_VERSION,
      highlights: {
        ok: highlight("ok"),
        bad: { book: "manual" },
        wrongBook: { ...highlight("x"), book: "../etc" },
      },
      bookmarks: [
        {
          car: "car",
          book: "manual",
          sectionId: "a",
          title: "A",
          href: "/auto/car/manual/a",
        },
        { book: "manual", sectionId: "a" },
        "junk",
      ],
      settings: {
        fontSize: "huge",
        showUnavailable: true,
        vehicles: {
          car: {
            "key.keyless": { status: "has", certainty: "confirmed" },
            "infotainment.premiumAudio": {
              status: "no",
              certainty: "probable",
            },
            "unknown.feature": { status: "has", certainty: "confirmed" },
            "drive.towbar": { status: "maybe" },
            "lights.afl": { status: "has", certainty: "unknown" },
          },
        },
      },
    });
    expect(Object.keys(data.highlights)).toEqual(["ok"]);
    expect(data.bookmarks).toHaveLength(1);
    expect(data.bookmarks[0].id).toBe("car:manual:a");
    expect(data.bookmarks[0].href).toBe("/auto/car/manual/a");
    expect(data.settings.fontSize).toBe("normal");
    expect(data.settings.showUnavailable).toBe(true);
    expect(data.settings.vehicles).toEqual({
      car: {
        "key.keyless": { status: "has", certainty: "confirmed" },
        "infotainment.premiumAudio": { status: "no", certainty: "probable" },
      },
    });
  });

  it("keeps equipment of every car and rejects invalid car ids", () => {
    const data = parseData({
      version: SCHEMA_VERSION,
      settings: {
        vehicles: {
          car: {
            "drive.towbar": { status: "has", certainty: "confirmed" },
            "made.up": { status: "has", certainty: "confirmed" },
          },
          "../x": { "drive.towbar": { status: "has", certainty: "confirmed" } },
          empty: {},
        },
      },
    });
    expect(data.settings.vehicles).toEqual({
      car: { "drive.towbar": { status: "has", certainty: "confirmed" } },
    });
  });

  it("sanitizes owned cars and keeps an empty list by default", () => {
    expect(createEmptyData().settings.ownedCars).toEqual([]);
    const data = parseData({
      version: SCHEMA_VERSION,
      settings: { ownedCars: ["car", "../unsafe", "car"] },
    });
    expect(data.settings.ownedCars).toEqual(["car"]);
  });
});

describe("history and reminders", () => {
  const car = "car";
  const entry = (sectionId: string, at: string) => ({
    car,
    book: "manual",
    sectionId,
    title: sectionId,
    href: `/auto/${car}/manual/${sectionId}`,
    thumb: null,
    at,
  });

  it("sanitizes and deduplicates history and reminders", () => {
    const bookmark = {
      id: `${car}:manual:a`,
      car,
      book: "manual",
      sectionId: "a",
      title: "A",
      href: `/auto/${car}/manual/a`,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const data = parseData({
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
          kind: "custom",
          title: "Przegląd",
          dueDate: "2026-05-01",
          dueKm: 120000,
        },
        { id: "r2", car, title: "" },
        { id: "r3", car, title: "Zła data", dueDate: "01.05.2026" },
      ],
    });
    expect(data.history.map((h) => [h.sectionId, h.at, h.thumb])).toEqual([
      ["a", "2026-01-03T00:00:00.000Z", null],
      ["c", "2026-01-02T00:00:00.000Z", null],
    ]);
    expect(data.reminders.map((r) => r.id)).toEqual(["r1", "r3"]);
    expect(data.reminders.map((r) => r.kind)).toEqual(["custom", "custom"]);
    expect(data.reminders[1].dueDate).toBeNull();
    expect(data.bookmarks.map((b) => b.id)).toEqual([bookmark.id]);
  });

  it("keeps one inspection and one OC reminder per car", () => {
    const data = parseData({
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

  it("drops impossible calendar dates from reminders", () => {
    const data = parseData({
      version: SCHEMA_VERSION,
      reminders: [
        { id: "valid", car, title: "Valid", dueDate: "2024-02-29" },
        { id: "invalid", car, title: "Invalid", dueDate: "2026-02-31" },
      ],
    });
    expect(data.reminders.map((r) => r.dueDate)).toEqual(["2024-02-29", null]);
  });

  it("keeps valid event dates without inferring them from deadlines", () => {
    const data = parseData({
      version: SCHEMA_VERSION,
      reminders: [
        {
          id: "valid",
          car,
          kind: "inspection",
          title: "Badanie",
          eventDate: "2026-03-01",
          dueDate: "2027-03-01",
        },
        {
          id: "invalid",
          car,
          title: "Data",
          eventDate: "2026-02-30",
          dueDate: "2026-05-01",
        },
      ],
    });
    expect(data.reminders.map((r) => [r.eventDate, r.dueDate])).toEqual([
      ["2026-03-01", "2027-03-01"],
      [null, "2026-05-01"],
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
        eventDate: null,
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
  it("accepts only versioned Glovebox export files", () => {
    const data = createEmptyData();
    data.highlights.a = highlight("a");
    const file = JSON.stringify({ app: EXPORT_APP_ID, exportedAt: "x", data });
    expect(parseImport(file).highlights.a.id).toBe("a");
    for (const invalid of [
      JSON.stringify({ app: "other", data }),
      JSON.stringify(data),
      JSON.stringify({ app: EXPORT_APP_ID, data: null }),
      "{not json",
    ])
      expect(() => parseImport(invalid)).toThrow(InvalidDataError);
    expect(() =>
      parseImport(JSON.stringify({ app: EXPORT_APP_ID, data: { version: 7 } })),
    ).toThrow(UnsupportedVersionError);
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
  it("starts empty without loading other applications' data", () => {
    const storage = memoryStorage({
      "another-app": JSON.stringify(createEmptyData()),
    });
    const store = new AppStore(storage);
    expect(store.get()).toEqual(createEmptyData());
    expect(store.lastError).toBeNull();
    expect(storage.data[STORAGE_KEY]).toBeUndefined();
  });

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

  it.each(["{broken", JSON.stringify({ version: 99 })])(
    "backs up unreadable or unsupported data instead of losing it",
    (raw) => {
      const storage = memoryStorage({ [STORAGE_KEY]: raw });
      const store = new AppStore(storage);
      expect(store.get()).toEqual(createEmptyData());
      const backup = Object.keys(storage.data).find((k) =>
        k.startsWith(`${STORAGE_KEY}:backup-`),
      );
      expect(backup).toBeDefined();
      expect(storage.data[backup!]).toBe(raw);
      expect(store.lastError).toBeTruthy();
    },
  );

  it("does not replace current data when an import is rejected", () => {
    const store = new AppStore(memoryStorage());
    store.update((d) => ({ ...d, highlights: { a: highlight("a") } }));
    const before = store.get();
    expect(() =>
      store.importJson(JSON.stringify({ app: "other", data: {} }), "replace"),
    ).toThrow(InvalidDataError);
    expect(store.get()).toBe(before);
  });

  it("exports, imports and clears", () => {
    const store = new AppStore(memoryStorage());
    store.update((d) => ({ ...d, highlights: { a: highlight("a") } }));
    const json = store.exportJson();
    expect(JSON.parse(json)).toMatchObject({
      app: "glovebox",
      data: { version: 1 },
    });
    store.clear();
    expect(store.get().highlights).toEqual({});
    store.importJson(json, "replace");
    expect(store.get().highlights.a.id).toBe("a");
    const other = createEmptyData();
    other.highlights.b = highlight("b");
    store.importJson(
      JSON.stringify({ app: EXPORT_APP_ID, data: other }),
      "merge",
    );
    expect(Object.keys(store.get().highlights).sort()).toEqual(["a", "b"]);
  });
});
