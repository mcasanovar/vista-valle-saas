"use client";

import { useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";

import { Button } from "@/presentation/atoms";

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value?: string) {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function formatDisplay(from?: string, to?: string) {
  if (!from) return "Cualquier fecha";
  const fromDate = parseIsoDate(from)!;
  const fromLabel = fromDate.toLocaleDateString("es-CL");
  if (!to || to === from) return fromLabel;
  const toLabel = parseIsoDate(to)!.toLocaleDateString("es-CL");
  return `${fromLabel} → ${toLabel}`;
}

function startOfWeek(date: Date) {
  const day = date.getDay();
  const diff = (day + 6) % 7; // Monday-first week.
  const result = new Date(date);
  result.setDate(date.getDate() - diff);
  return result;
}

function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(date.getDate() + amount);
  return result;
}

type QuickChip = Readonly<{ label: string; range: () => DateRange }>;

function buildQuickChips(): readonly QuickChip[] {
  const today = new Date();
  return [
    { label: "Hoy", range: () => ({ from: today, to: today }) },
    {
      label: "Esta semana",
      range: () => ({ from: startOfWeek(today), to: addDays(startOfWeek(today), 6) }),
    },
    {
      label: "Próximos 7 días",
      range: () => ({ from: today, to: addDays(today, 6) }),
    },
  ];
}

/**
 * A single calendar control that doubles as an exact-date and a range
 * filter: selecting one day and stopping there is treated as an exact date
 * (`from === to`); selecting a start and end day produces a range. Renders
 * two hidden inputs (`${name}From`/`${name}To`) so the enclosing filter
 * `<form>` submits the range like any other field — no client-side fetch,
 * no debounce (see design.md decision 5 / proposal "búsqueda con botón o
 * Enter").
 */
export function DateRangeField({
  defaultFrom,
  defaultTo,
  label,
  name,
}: Readonly<{
  defaultFrom?: string;
  defaultTo?: string;
  label: string;
  name: string;
}>) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>(() => {
    const from = parseIsoDate(defaultFrom);
    const to = parseIsoDate(defaultTo);
    return from ? { from, to: to ?? from } : undefined;
  });

  const from = range?.from ? toIsoDate(range.from) : "";
  const to = range?.to ? toIsoDate(range.to) : from;

  return (
    <div className="relative inline-block">
      <input type="hidden" name={`${name}From`} value={from} />
      <input type="hidden" name={`${name}To`} value={to} />
      <Button
        type="button"
        variant="secondary"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        {label}: {formatDisplay(from, to)}
      </Button>
      {open ? (
        <div className="absolute left-0 top-[calc(100%+0.5rem)] z-20 rounded-xl border border-border bg-card p-3 shadow-lg">
          <div className="mb-2 flex flex-wrap gap-2">
            {buildQuickChips().map((chip) => (
              <button
                key={chip.label}
                type="button"
                className="rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-muted"
                onClick={() => setRange(chip.range())}
              >
                {chip.label}
              </button>
            ))}
            {range ? (
              <button
                type="button"
                className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
                onClick={() => setRange(undefined)}
              >
                Limpiar
              </button>
            ) : null}
          </div>
          <DayPicker
            className="admin-date-picker"
            mode="range"
            selected={range}
            onSelect={setRange}
          />
          <div className="mt-2 flex justify-end">
            <Button type="button" onClick={() => setOpen(false)}>
              Listo
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
