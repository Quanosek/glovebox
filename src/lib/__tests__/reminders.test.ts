import { describe, expect, it } from "vitest";
import {
  addYear,
  daysUntil,
  dueSoon,
  formatManualDateInput,
  getMonthGridDays,
  isFutureDate,
  parseManualDate,
  sortReminders,
  toManualDate,
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

  it("disallows dates after today but allows today", () => {
    expect(isFutureDate("2026-10-09", "2026-10-09")).toBe(false);
    expect(isFutureDate("2026-10-10", "2026-10-09")).toBe(true);
  });

  it("formats and validates manual dates without requiring dots", () => {
    expect(formatManualDateInput("09102026")).toBe("09.10.2026");
    expect(formatManualDateInput("0910")).toBe("09.10");
    expect(parseManualDate("09102026")).toBe("2026-10-09");
    expect(parseManualDate("09.10.2026")).toBe("2026-10-09");
    expect(parseManualDate("9/10/2026")).toBe("2026-10-09");
    expect(parseManualDate("9,10,2026")).toBe("2026-10-09");
    expect(parseManualDate("31.02.2026")).toBeNull();
    expect(parseManualDate("9.10.26")).toBeNull();
    expect(formatManualDateInput("9/10,2026x")).toBe("9.10.2026");
    expect(toManualDate("2026-10-09")).toBe("09.10.2026");
  });

  it("moves a date by one year, also from 29 February", () => {
    expect(addYear("2026-10-09")).toBe("2027-10-09");
    expect(addYear("2028-02-29")).toBe("2029-02-28");
  });

  it("builds a six-week calendar grid starting on Monday", () => {
    const may = getMonthGridDays(2026, 5);
    expect(may).toHaveLength(42);
    expect(may.slice(0, 5)).toEqual([null, null, null, null, 1]);
    expect(may[34]).toBe(31);
    expect(may.slice(35)).toEqual(Array(7).fill(null));

    const leapFebruary = getMonthGridDays(2024, 2);
    expect(leapFebruary[3]).toBe(1);
    expect(leapFebruary[31]).toBe(29);
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
