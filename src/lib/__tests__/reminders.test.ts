import { describe, expect, it } from "vitest";
import {
  addYear,
  daysUntil,
  dueSoon,
  sortReminders,
  todayIso,
} from "@/lib/reminders";
import type { Reminder } from "@/lib/storage/schema";

const reminder = (over: Partial<Reminder>): Reminder => ({
  id: "r",
  car: "opel-astra-2018",
  kind: "custom",
  title: "Przegląd",
  dueDate: null,
  eventDate: null,
  dueKm: null,
  done: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("reminders", () => {
  it("counts calendar days across DST and years", () => {
    expect(daysUntil("2026-10-10", "2026-10-09")).toBe(1);
    expect(daysUntil("2026-03-30", "2026-03-28")).toBe(2);
    expect(daysUntil("2025-12-31", "2026-01-01")).toBe(-1);
  });

  it("moves a date by one year, also from 29 February", () => {
    expect(addYear("2026-10-09")).toBe("2027-10-09");
    expect(addYear("2028-02-29")).toBe("2029-02-28");
  });

  it("formats today as a local calendar day", () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });

  it("finds due reminders of the profile's cars only", () => {
    const list = [
      reminder({ id: "a", dueDate: "2026-11-01" }),
      reminder({ id: "b", dueDate: "2026-09-01" }),
      reminder({ id: "c", dueDate: "2027-01-01" }),
      reminder({ id: "d", dueDate: "2026-10-10", done: true }),
      reminder({ id: "e", dueDate: "2026-10-10", car: "other-car" }),
    ];
    expect(
      dueSoon(list, "2026-10-09", ["opel-astra-2018"]).map((r) => r.id),
    ).toEqual(["a", "b"]);
  });

  it("sorts open reminders by date, done and undated last", () => {
    const list = [
      reminder({ id: "done", dueDate: "2026-01-01", done: true }),
      reminder({ id: "none" }),
      reminder({ id: "late", dueDate: "2027-01-01" }),
      reminder({ id: "soon", dueDate: "2026-11-01" }),
    ];
    expect(sortReminders(list).map((r) => r.id)).toEqual([
      "soon",
      "late",
      "none",
      "done",
    ]);
  });
});
