import Link from "next/link";

import {
  calendarRangeForAnchor,
  calendarRangePresets,
  nextCalendarRange,
  previousCalendarRange,
  todayCalendarRange,
  type CalendarGranularity,
  type CalendarRange,
  type CalendarRangePreset,
} from "./calendar-range";

const presetLabels: Readonly<Record<CalendarRangePreset, string>> = {
  month: "Mes",
  next_7_days: "Próximos 7 días",
  two_weeks: "2 semanas",
  week: "Semana",
};

const originOptions = [
  { label: "Todos", value: "" },
  { label: "Sitio web", value: "website" },
  { label: "Airbnb", value: "airbnb" },
  { label: "Booking", value: "booking" },
  { label: "Teléfono", value: "phone" },
  { label: "WhatsApp", value: "whatsapp" },
  { label: "Administración", value: "admin" },
] as const;

function hrefFor(
  basePath: string,
  searchParams: Readonly<Record<string, string | undefined>>,
  overrides: Readonly<Record<string, string | undefined>>
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...searchParams, ...overrides })) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function CalendarToolbar({
  basePath,
  granularity,
  range,
  rooms,
  searchParams,
}: Readonly<{
  basePath: string;
  granularity: CalendarGranularity;
  range: CalendarRange;
  rooms: readonly Readonly<{ id: string; name: string }>[];
  searchParams: Readonly<Record<string, string | undefined>>;
}>) {
  const previous = previousCalendarRange(range);
  const next = nextCalendarRange(range);
  const home = todayCalendarRange(range.preset);

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          aria-label="Periodo anterior"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border"
          href={hrefFor(basePath, searchParams, { checkIn: previous.checkIn })}
        >
          ◀
        </Link>
        <Link
          aria-label="Periodo siguiente"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border"
          href={hrefFor(basePath, searchParams, { checkIn: next.checkIn })}
        >
          ▶
        </Link>
        <Link
          className="min-h-11 rounded-md border border-border px-3 py-2 text-sm font-semibold"
          href={hrefFor(basePath, searchParams, { checkIn: home.checkIn })}
        >
          Hoy
        </Link>
        <span className="text-sm font-medium text-muted-foreground">
          {range.checkIn} – {range.checkOut}
        </span>
      </div>
      <div
        aria-label="Rango de calendario"
        className="flex flex-wrap items-center gap-2"
        role="group"
      >
        {calendarRangePresets.map((preset) => {
          const presetRange = calendarRangeForAnchor(preset, range.checkIn);
          const active = preset === range.preset;
          return (
            <Link
              aria-current={active ? "true" : undefined}
              className={`min-h-11 rounded-md px-3 py-2 text-sm font-semibold ${
                active ? "bg-accent text-on-accent" : "border border-border"
              }`}
              href={hrefFor(basePath, searchParams, {
                checkIn: presetRange.checkIn,
                granularity: preset === "month" ? granularity : undefined,
                preset,
              })}
              key={preset}
            >
              {presetLabels[preset]}
            </Link>
          );
        })}
        {range.preset === "month" ? (
          <Link
            className="min-h-11 rounded-md border border-border px-3 py-2 text-sm font-semibold"
            href={hrefFor(basePath, searchParams, {
              granularity: granularity === "weekly" ? "daily" : "weekly",
            })}
          >
            {granularity === "weekly" ? "Vista diaria" : "Vista semanal comprimida"}
          </Link>
        ) : null}
      </div>
      <form
        aria-label="Filtrar calendario"
        className="flex flex-wrap items-end gap-3"
        method="get"
      >
        <input name="preset" type="hidden" value={range.preset} />
        <input name="checkIn" type="hidden" value={range.checkIn} />
        {range.preset === "month" ? (
          <input name="granularity" type="hidden" value={granularity} />
        ) : null}
        <label className="flex items-center gap-2 text-sm">
          Habitación
          <select
            className="min-h-11 rounded-md border border-border bg-card px-3"
            defaultValue={searchParams.roomId ?? ""}
            name="roomId"
          >
            <option value="">Todas</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          Origen
          <select
            className="min-h-11 rounded-md border border-border bg-card px-3"
            defaultValue={searchParams.origin ?? ""}
            name="origin"
          >
            {originOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="min-h-11 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-on-accent"
          type="submit"
        >
          Filtrar
        </button>
        <Link
          className="min-h-11 rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground"
          href={hrefFor(basePath, searchParams, {
            origin: undefined,
            roomId: undefined,
          })}
        >
          Limpiar filtros
        </Link>
      </form>
    </div>
  );
}
