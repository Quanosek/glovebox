"use client";

import { useLayoutEffect, useRef, useState } from "react";
import {
  formatDate,
  formatManualDateInput,
  getMonthGridDays,
  isFutureDate,
  parseManualDate,
  toManualDate,
  todayIso,
} from "@/lib/reminders";

const WEEKDAYS = [
  { short: "Pn", full: "Poniedziałek" },
  { short: "Wt", full: "Wtorek" },
  { short: "Śr", full: "Środa" },
  { short: "Cz", full: "Czwartek" },
  { short: "Pt", full: "Piątek" },
  { short: "So", full: "Sobota" },
  { short: "Nd", full: "Niedziela" },
];
const MONTHS = Array.from({ length: 12 }, (_, month) =>
  new Intl.DateTimeFormat("pl-PL", { month: "long" }).format(
    new Date(2026, month, 1),
  ),
);

function firstOfMonth(date: string) {
  const [year, month] = date.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function toIsoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const GAP = 6;
const MARGIN = 8;

/** Places the fixed calendar below the field, or above it when there is more room there. */
function placeCalendar(anchor: HTMLElement, calendar: HTMLElement) {
  const field = anchor.getBoundingClientRect();
  const viewportHeight = document.documentElement.clientHeight;
  const viewportWidth = document.documentElement.clientWidth;
  calendar.style.maxHeight = "";
  const height = calendar.offsetHeight;
  const width = calendar.offsetWidth;
  const below = viewportHeight - field.bottom - GAP - MARGIN;
  const above = field.top - GAP - MARGIN;
  const up = height > below && above > below;
  const room = Math.max(0, up ? above : below);

  calendar.style.maxHeight = `${room}px`;
  calendar.style.top = `${up ? field.top - GAP - Math.min(height, room) : field.bottom + GAP}px`;
  calendar.style.left = `${Math.max(MARGIN, Math.min(field.left, viewportWidth - width - MARGIN))}px`;
  calendar.style.visibility = "visible";
}

export function ReminderDatePicker({
  id,
  value,
  disabled,
  onChange,
}: {
  id: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const today = todayIso();
  const [todayYear, todayMonth] = today.split("-").map(Number);
  const [open, setOpen] = useState(false);
  const [manualValue, setManualValue] = useState(() =>
    value ? toManualDate(value) : "",
  );
  const [dateError, setDateError] = useState("");
  const [visibleMonth, setVisibleMonth] = useState(() =>
    firstOfMonth(value && value <= today ? value : today),
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const controlRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth() + 1;
  const days = getMonthGridDays(year, month);
  const canNavigateNext =
    year < todayYear || (year === todayYear && month < todayMonth);

  useLayoutEffect(() => {
    if (!open) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const reposition = () => {
      if (controlRef.current && calendarRef.current)
        placeCalendar(controlRef.current, calendarRef.current);
    };
    reposition();

    window.addEventListener("pointerdown", closeOnOutsidePointer);
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("pointerdown", closeOnOutsidePointer);
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  const selectDate = (date: string) => {
    if (isFutureDate(date, today)) return;
    setManualValue(toManualDate(date));
    setDateError("");
    onChange(date);
    setOpen(false);
  };

  const handleManualChange = (raw: string) => {
    const text = formatManualDateInput(raw);
    setManualValue(text);
    setDateError("");

    const date = parseManualDate(text);
    if (!date) {
      onChange("");
      return;
    }
    if (isFutureDate(date, today)) {
      setDateError("Data nie może być późniejsza niż dzisiaj.");
      onChange("");
      return;
    }
    setVisibleMonth(firstOfMonth(date));
    onChange(date);
  };

  const handleManualBlur = () => {
    const date = parseManualDate(manualValue);
    if (date && !isFutureDate(date, today)) setManualValue(toManualDate(date));
    else if (manualValue && !dateError)
      setDateError("Wpisz datę jako DD.MM.YYYY.");
  };

  const toggleCalendar = () => {
    if (open) {
      setOpen(false);
      return;
    }

    setVisibleMonth(firstOfMonth(value && value <= today ? value : today));
    setOpen(true);
  };

  return (
    <div ref={containerRef} className="min-w-0 flex-1">
      <div ref={controlRef} className="date-picker-control">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          className="field date-picker-input h-11"
          placeholder="DD.MM.YYYY"
          value={manualValue}
          disabled={disabled}
          aria-label="Data w formacie DD.MM.YYYY"
          aria-invalid={dateError !== ""}
          aria-describedby={dateError ? `${id}-error` : undefined}
          onChange={(event) => handleManualChange(event.currentTarget.value)}
          onBlur={handleManualBlur}
        />
        <button
          type="button"
          className="date-picker-calendar-button"
          disabled={disabled}
          aria-label={open ? "Zamknij kalendarz" : "Otwórz kalendarz"}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? `${id}-calendar` : undefined}
          onClick={toggleCalendar}
        >
          <span className="calendar-icon" aria-hidden="true" />
        </button>
      </div>
      {open && (
        <div
          ref={calendarRef}
          id={`${id}-calendar`}
          className="reminder-calendar"
          role="dialog"
          aria-label="Wybierz datę"
        >
          <div className="calendar-month-bar flex items-center gap-1">
            <button
              type="button"
              className="btn btn-ghost h-7 w-7 shrink-0 justify-center p-0 text-xl leading-none"
              aria-label="Poprzedni miesiąc"
              onClick={() =>
                setVisibleMonth(
                  (current) =>
                    new Date(current.getFullYear(), current.getMonth() - 1, 1),
                )
              }
            >
              ‹
            </button>
            <select
              className="field calendar-select calendar-month-select"
              aria-label="Miesiąc"
              value={month}
              onChange={(event) =>
                setVisibleMonth(
                  (current) =>
                    new Date(
                      current.getFullYear(),
                      Number(event.target.value) - 1,
                      1,
                    ),
                )
              }
            >
              {MONTHS.map((monthName, index) => (
                <option
                  key={monthName}
                  value={index + 1}
                  disabled={
                    year > todayYear ||
                    (year === todayYear && index + 1 > todayMonth)
                  }
                >
                  {monthName}
                </option>
              ))}
            </select>
            <span className="calendar-year-label" aria-live="polite">
              {year}
            </span>
            <button
              type="button"
              className="btn btn-ghost h-7 w-7 shrink-0 justify-center p-0 text-xl leading-none"
              aria-label="Następny miesiąc"
              disabled={!canNavigateNext}
              onClick={() =>
                setVisibleMonth(
                  (current) =>
                    new Date(current.getFullYear(), current.getMonth() + 1, 1),
                )
              }
            >
              ›
            </button>
          </div>
          <div className="calendar-weekdays" aria-hidden="true">
            {WEEKDAYS.map((weekday) => (
              <span key={weekday.short} title={weekday.full}>
                {weekday.short}
              </span>
            ))}
          </div>
          <div className="calendar-days">
            {days.map((day, index) => {
              if (day === null)
                return <span key={`empty-${index}`} aria-hidden="true" />;

              const date = toIsoDate(year, month, day);
              const isSelected = date === value;
              const isToday = date === today;
              const isFuture = isFutureDate(date, today);
              return (
                <button
                  key={date}
                  type="button"
                  className={`calendar-day ${isToday ? "calendar-day-today" : ""} ${isSelected ? "calendar-day-selected" : ""}`}
                  aria-label={formatDate(date)}
                  aria-pressed={isSelected}
                  disabled={isFuture}
                  onClick={() => selectDate(date)}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <div className="mt-1 flex justify-end border-t border-line pt-1">
            <button
              type="button"
              className="btn btn-ghost h-7 justify-center px-2 py-0"
              onClick={() => selectDate(today)}
            >
              Dzisiaj
            </button>
          </div>
        </div>
      )}
      {dateError && (
        <span id={`${id}-error`} className="date-picker-error" role="alert">
          {dateError}
        </span>
      )}
    </div>
  );
}
