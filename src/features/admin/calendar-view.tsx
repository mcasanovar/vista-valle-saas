"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

// eslint-disable-next-line architecture/feature-public-api -- this Client Component must not traverse the server-only availability barrel.
import {
  addLodgingDays,
  LODGING_TIME_ZONE,
} from "@/features/availability/client-date-only";
import type { AdminCalendarItem } from "@/infrastructure/database/admin-calendar-source";
import { calendarItemStyle } from "./calendar-item-style";
import {
  weekBucketsWithin,
  type CalendarGranularity,
  type CalendarRange,
} from "./calendar-range";
import {
  CalendarDetailSheet,
  CalendarRangeTransition,
  CalendarStaggerGroup,
  CalendarStaggerItem,
} from "./calendar-motion";
import { OriginIcon, originLabels } from "./origin-icon";

export type CalendarRoom = Readonly<{ id: string; name: string }>;

type EmptySelection = Readonly<{
  /** Unset when quick-create starts from a day cell in the classic grid with no room filter active - the form itself asks which room. */
  roomId?: string;
  roomName?: string;
  date: string;
}>;

const MAX_VISIBLE_DAY_CHIPS = 3;

const weekdayFormatter = new Intl.DateTimeFormat("es-CL", {
  timeZone: LODGING_TIME_ZONE,
  weekday: "narrow",
});
const longDayFormatter = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "long",
  timeZone: LODGING_TIME_ZONE,
  weekday: "long",
});

function dateParts(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return { day: day!, month: month!, year: year! };
}

function utcNoon(date: string) {
  const { day, month, year } = dateParts(date);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function isWeekend(date: string) {
  const dow = utcNoon(date).getUTCDay();
  return dow === 0 || dow === 6;
}

function formatShortDay(date: string) {
  return `${weekdayFormatter.format(utcNoon(date))} ${dateParts(date).day}`;
}

function formatLongDay(date: string) {
  const formatted = longDayFormatter.format(utcNoon(date));
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function enumerateDays(checkIn: string, checkOut: string): readonly string[] {
  const days: string[] = [];
  let cursor = checkIn;
  while (cursor < checkOut) {
    days.push(cursor);
    cursor = addLodgingDays(cursor, 1);
  }
  return days;
}

function groupItemsByRoom(items: readonly AdminCalendarItem[]) {
  const map = new Map<string, AdminCalendarItem[]>();
  for (const item of items) {
    const list = map.get(item.roomId) ?? [];
    list.push(item);
    map.set(item.roomId, list);
  }
  return map;
}

function itemGridPosition(item: AdminCalendarItem, days: readonly string[]) {
  const firstDay = days[0]!;
  const lastDay = days[days.length - 1]!;
  const startIndex =
    item.checkIn <= firstDay ? 0 : days.indexOf(item.checkIn);
  const endIndex =
    item.checkOut > lastDay ? days.length : days.indexOf(item.checkOut);
  const resolvedStart = startIndex === -1 ? 0 : startIndex;
  const resolvedEnd = endIndex === -1 ? resolvedStart + 1 : endIndex;
  return {
    span: Math.max(1, resolvedEnd - resolvedStart),
    startIndex: resolvedStart,
  };
}

function buildHref(
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

function CalendarLegend() {
  const entries = [
    {
      backgroundVar: "--admin-reservation-confirmed-background",
      colorVar: "--admin-reservation-confirmed",
      label: "Reserva confirmada",
    },
    {
      backgroundVar: "--admin-reservation-pending-background",
      colorVar: "--admin-reservation-pending",
      label: "No se presentó",
    },
    {
      backgroundVar: "--admin-hold-background",
      colorVar: "--admin-hold",
      dashed: true,
      label: "Retención",
    },
    {
      backgroundVar: "--admin-block-background",
      colorVar: "--admin-block",
      label: "Bloqueo",
      pattern: true,
    },
  ] as const;
  return (
    <ul aria-label="Leyenda" className="flex flex-wrap gap-4 text-sm">
      {entries.map((entry) => (
        <li className="flex items-center gap-1.5" key={entry.label}>
          <span
            aria-hidden="true"
            className={`h-3 w-3 rounded-sm ${"dashed" in entry && entry.dashed ? "border-2 border-dashed" : ""} ${"pattern" in entry && entry.pattern ? "admin-calendar-block-pattern" : ""}`}
            style={{
              backgroundColor:
                "pattern" in entry && entry.pattern
                  ? undefined
                  : `var(${entry.backgroundVar})`,
              borderColor:
                "dashed" in entry && entry.dashed
                  ? `var(${entry.colorVar})`
                  : undefined,
            }}
          />
          {entry.label}
        </li>
      ))}
    </ul>
  );
}

function ItemBarLabel({ item }: Readonly<{ item: AdminCalendarItem }>) {
  if (item.kind === "block")
    return <span className="truncate">{item.reason}</span>;
  return (
    <>
      {item.kind === "reservation" && item.origin ? (
        <OriginIcon className="h-3.5 w-3.5 shrink-0" origin={item.origin} />
      ) : null}
      <span className="truncate">{item.guestName}</span>
    </>
  );
}

function DesktopTimeline({
  days,
  rooms,
  grouped,
  today,
  onSelectItem,
  onSelectEmpty,
}: Readonly<{
  days: readonly string[];
  rooms: readonly CalendarRoom[];
  grouped: Map<string, AdminCalendarItem[]>;
  today: string;
  onSelectItem: (item: AdminCalendarItem) => void;
  onSelectEmpty: (selection: EmptySelection) => void;
}>) {
  const columnTemplate = `10rem repeat(${days.length}, minmax(2.75rem, 1fr))`;
  return (
    <div className="hidden overflow-x-auto rounded-xl border border-border tablet:block">
      <div className="grid" style={{ gridTemplateColumns: columnTemplate }}>
        <div
          className="sticky left-0 z-30 border-b border-border bg-card p-2 text-sm font-semibold"
          style={{ gridColumn: 1, gridRow: 1 }}
        >
          Habitación
        </div>
        {days.map((day, dayIndex) => (
          <div
            className="border-b border-border p-2 text-center text-xs font-medium"
            key={day}
            style={{
              backgroundColor: isWeekend(day)
                ? "var(--admin-calendar-weekend-background)"
                : undefined,
              color:
                day === today
                  ? "var(--admin-calendar-today)"
                  : "var(--color-muted-foreground)",
              gridColumn: dayIndex + 2,
              gridRow: 1,
            }}
          >
            {formatShortDay(day)}
          </div>
        ))}
        {rooms.map((room, roomIndex) => {
          const row = roomIndex + 2;
          const items = grouped.get(room.id) ?? [];
          return (
            <div
              className="contents"
              key={room.id}
              role="row"
              aria-label={room.name}
            >
              <div
                className="sticky left-0 z-20 flex items-center border-b border-border bg-card p-2 text-sm font-medium"
                style={{ gridColumn: 1, gridRow: row }}
              >
                {room.name}
              </div>
              {days.map((day, dayIndex) => (
                <button
                  aria-label={`Crear reserva o bloqueo para ${room.name} el ${day}`}
                  className="min-h-11 cursor-pointer border-b border-border hover:bg-muted"
                  key={day}
                  onClick={() =>
                    onSelectEmpty({ date: day, roomId: room.id, roomName: room.name })
                  }
                  style={{
                    backgroundColor: isWeekend(day)
                      ? "var(--admin-calendar-weekend-background)"
                      : undefined,
                    borderLeft:
                      day === today
                        ? "2px solid var(--admin-calendar-today)"
                        : undefined,
                    gridColumn: dayIndex + 2,
                    gridRow: row,
                  }}
                  type="button"
                />
              ))}
              {items.map((item) => {
                const { span, startIndex } = itemGridPosition(item, days);
                const style = calendarItemStyle(item);
                return (
                  <button
                    className={`relative z-10 m-0.5 flex cursor-pointer items-center gap-1 truncate rounded-md px-2 text-left text-xs font-semibold ${style.className}`}
                    key={item.id}
                    onClick={() => onSelectItem(item)}
                    style={{
                      backgroundColor: style.className
                        ? undefined
                        : `var(${style.backgroundVar})`,
                      color: `var(${style.colorVar})`,
                      gridColumn: `${startIndex + 2} / span ${span}`,
                      gridRow: row,
                    }}
                    type="button"
                  >
                    <ItemBarLabel item={item} />
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MobileAgenda({
  days,
  rooms,
  grouped,
  today,
  onSelectItem,
  onSelectEmpty,
}: Readonly<{
  days: readonly string[];
  rooms: readonly CalendarRoom[];
  grouped: Map<string, AdminCalendarItem[]>;
  today: string;
  onSelectItem: (item: AdminCalendarItem) => void;
  onSelectEmpty: (selection: EmptySelection) => void;
}>) {
  return (
    <div className="space-y-4 tablet:hidden">
      {days.map((day) => {
        const dayEntries = rooms.map((room) => ({
          item: (grouped.get(room.id) ?? []).find(
            (candidate) => candidate.checkIn <= day && candidate.checkOut > day
          ),
          room,
        }));
        return (
          <section
            aria-labelledby={`calendar-day-${day}`}
            className="rounded-xl border border-border p-3"
            key={day}
            style={{
              backgroundColor: isWeekend(day)
                ? "var(--admin-calendar-weekend-background)"
                : "var(--color-card)",
              boxShadow:
                day === today
                  ? "inset 0 0 0 2px var(--admin-calendar-today)"
                  : undefined,
            }}
          >
            <h2 className="mb-2 text-sm font-semibold" id={`calendar-day-${day}`}>
              {formatLongDay(day)}
              {day === today ? (
                <span className="ml-2 text-xs font-normal text-[var(--admin-calendar-today)]">
                  Hoy
                </span>
              ) : null}
            </h2>
            <CalendarStaggerGroup className="space-y-2">
              {dayEntries.map(({ room, item }) => (
                <CalendarStaggerItem key={room.id}>
                  {item ? (
                    <button
                      className={`flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${calendarItemStyle(item).className}`}
                      onClick={() => onSelectItem(item)}
                      style={{
                        backgroundColor: calendarItemStyle(item).className
                          ? undefined
                          : `var(${calendarItemStyle(item).backgroundVar})`,
                        color: `var(${calendarItemStyle(item).colorVar})`,
                      }}
                      type="button"
                    >
                      <span className="font-semibold">{room.name}</span>
                      <ItemBarLabel item={item} />
                    </button>
                  ) : (
                    <button
                      className="flex min-h-11 w-full cursor-pointer items-center justify-between rounded-lg border border-dashed border-border px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
                      onClick={() =>
                        onSelectEmpty({
                          date: day,
                          roomId: room.id,
                          roomName: room.name,
                        })
                      }
                      type="button"
                    >
                      <span>{room.name}</span>
                      <span aria-hidden="true">+</span>
                    </button>
                  )}
                </CalendarStaggerItem>
              ))}
            </CalendarStaggerGroup>
          </section>
        );
      })}
    </div>
  );
}

function dayItemsAcrossRooms(
  day: string,
  rooms: readonly CalendarRoom[],
  grouped: Map<string, AdminCalendarItem[]>
): readonly AdminCalendarItem[] {
  const items: AdminCalendarItem[] = [];
  for (const room of rooms) {
    const match = (grouped.get(room.id) ?? []).find(
      (candidate) => candidate.checkIn <= day && candidate.checkOut > day
    );
    if (match) items.push(match);
  }
  return items;
}

/**
 * Mes/Semana/2 semanas (task 9.1): a classic calendar grid - fixed
 * Monday-to-Sunday columns, one row per week in the range, the day number
 * small in the cell's top-right corner instead of filling it. Each
 * occupied room becomes a chip inside its day's cell (task 9.2); Próximos
 * 7 días keeps the room-timeline (`DesktopTimeline`) instead, since it is
 * not week-aligned (see design.md).
 */
function ClassicCalendarGrid({
  range,
  rooms,
  grouped,
  today,
  activeRoomFilter,
  onSelectItem,
  onSelectEmpty,
  onSelectDayOverflow,
}: Readonly<{
  range: CalendarRange;
  rooms: readonly CalendarRoom[];
  grouped: Map<string, AdminCalendarItem[]>;
  today: string;
  activeRoomFilter?: Readonly<{ id: string; name: string }>;
  onSelectItem: (item: AdminCalendarItem) => void;
  onSelectEmpty: (selection: EmptySelection) => void;
  onSelectDayOverflow: (day: string, items: readonly AdminCalendarItem[]) => void;
}>) {
  const weeks = useMemo(
    () =>
      weekBucketsWithin(range).map((bucket) =>
        enumerateDays(bucket.checkIn, bucket.checkOut)
      ),
    [range]
  );
  const weekdayLabels = ["L", "M", "M", "J", "V", "S", "D"];

  return (
    <div className="hidden overflow-hidden rounded-xl border border-border tablet:block">
      <div className="grid grid-cols-7 border-b border-border">
        {weekdayLabels.map((label, index) => (
          <div
            className="p-2 text-center text-xs font-semibold text-muted-foreground"
            key={`${label}-${index}`}
          >
            {label}
          </div>
        ))}
      </div>
      {weeks.map((week) => (
        <div className="grid grid-cols-7" key={week[0]}>
          {week.map((day) => {
            const inRange = day >= range.checkIn && day < range.checkOut;
            const items = dayItemsAcrossRooms(day, rooms, grouped);
            const visibleItems = items.slice(0, MAX_VISIBLE_DAY_CHIPS);
            const overflow = items.length - visibleItems.length;
            return (
              <div
                className={`flex min-h-28 flex-col gap-1 border-b border-r border-border p-1.5 last:border-r-0 ${inRange ? "" : "opacity-40"}`}
                key={day}
                style={{
                  backgroundColor: isWeekend(day)
                    ? "var(--admin-calendar-weekend-background)"
                    : undefined,
                  boxShadow:
                    day === today
                      ? "inset 0 0 0 2px var(--admin-calendar-today)"
                      : undefined,
                }}
              >
                <span
                  className="self-end text-xs font-semibold"
                  style={{
                    color:
                      day === today
                        ? "var(--admin-calendar-today)"
                        : "var(--color-muted-foreground)",
                  }}
                >
                  {dateParts(day).day}
                </span>
                <CalendarStaggerGroup className="flex flex-col gap-1">
                  {visibleItems.map((item) => {
                    const style = calendarItemStyle(item);
                    return (
                      <CalendarStaggerItem key={item.id}>
                        <button
                          className={`flex w-full cursor-pointer items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11px] font-semibold ${style.className}`}
                          onClick={() => onSelectItem(item)}
                          style={{
                            backgroundColor: style.className
                              ? undefined
                              : `var(${style.backgroundVar})`,
                            color: `var(${style.colorVar})`,
                          }}
                          type="button"
                        >
                          <span className="truncate">{item.room}</span>
                        </button>
                      </CalendarStaggerItem>
                    );
                  })}
                </CalendarStaggerGroup>
                {overflow > 0 ? (
                  <button
                    className="cursor-pointer text-left text-[11px] font-semibold text-muted-foreground"
                    onClick={() => onSelectDayOverflow(day, items)}
                    type="button"
                  >
                    +{overflow} más
                  </button>
                ) : null}
                {inRange ? (
                  <button
                    aria-label={
                      activeRoomFilter
                        ? `Crear reserva o bloqueo para ${activeRoomFilter.name} el ${day}`
                        : `Crear reserva o bloqueo el ${day}`
                    }
                    className="mt-auto flex min-h-6 cursor-pointer items-center justify-center rounded text-xs text-muted-foreground hover:bg-muted"
                    onClick={() =>
                      onSelectEmpty({
                        date: day,
                        roomId: activeRoomFilter?.id,
                        roomName: activeRoomFilter?.name,
                      })
                    }
                    type="button"
                  >
                    +
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function DayDetailContent({
  date,
  items,
  onSelectItem,
  onClose,
}: Readonly<{
  date: string;
  items: readonly AdminCalendarItem[];
  onSelectItem: (item: AdminCalendarItem) => void;
  onClose: () => void;
}>) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-heading text-lg font-semibold">
          {formatLongDay(date)}
        </h2>
        <button
          aria-label="Cerrar"
          className="cursor-pointer text-muted-foreground"
          onClick={onClose}
          type="button"
        >
          ✕
        </button>
      </div>
      <ul className="space-y-2">
        {items.map((item) => {
          const style = calendarItemStyle(item);
          return (
            <li key={item.id}>
              <button
                className={`flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${style.className}`}
                onClick={() => onSelectItem(item)}
                style={{
                  backgroundColor: style.className
                    ? undefined
                    : `var(${style.backgroundVar})`,
                  color: `var(${style.colorVar})`,
                }}
                type="button"
              >
                <span className="font-semibold">{item.room}</span>
                <ItemBarLabel item={item} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CompressedMonthGrid({
  range,
  rooms,
  grouped,
  days,
  basePath,
  searchParams,
}: Readonly<{
  range: CalendarRange;
  rooms: readonly CalendarRoom[];
  grouped: Map<string, AdminCalendarItem[]>;
  days: readonly string[];
  basePath: string;
  searchParams: Readonly<Record<string, string | undefined>>;
}>) {
  const buckets = useMemo(() => weekBucketsWithin(range), [range]);
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <th className="p-2">Habitación</th>
            {buckets.map((bucket, index) => (
              <th className="p-2 text-center" key={bucket.checkIn}>
                Sem {index + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rooms.map((room) => (
            <tr key={room.id}>
              <td className="p-2 font-medium">{room.name}</td>
              {buckets.map((bucket) => {
                const bucketDays = enumerateDays(
                  bucket.checkIn,
                  bucket.checkOut
                ).filter((day) => days.includes(day));
                const roomItems = grouped.get(room.id) ?? [];
                const occupiedDays = bucketDays.filter((day) =>
                  roomItems.some(
                    (item) =>
                      item.kind === "reservation" &&
                      item.checkIn <= day &&
                      item.checkOut > day
                  )
                );
                const percentage = bucketDays.length
                  ? Math.round((occupiedDays.length / bucketDays.length) * 100)
                  : 0;
                return (
                  <td className="p-2 text-center" key={bucket.checkIn}>
                    <Link
                      className="inline-block min-h-11 w-full rounded-md px-2 py-2 text-xs font-semibold"
                      href={buildHref(basePath, searchParams, {
                        checkIn: bucket.checkIn,
                        granularity: "daily",
                        preset: "week",
                      })}
                      style={{
                        backgroundColor:
                          "var(--admin-reservation-confirmed-background)",
                        color: "var(--admin-reservation-confirmed)",
                      }}
                    >
                      {percentage}%
                    </Link>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailPanelContent({
  item,
  onClose,
}: Readonly<{ item: AdminCalendarItem; onClose: () => void }>) {
  const style = calendarItemStyle(item);
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <h2
          className="font-heading text-lg font-semibold"
          style={{ color: `var(${style.colorVar})` }}
        >
          {style.label}
        </h2>
        <button
          aria-label="Cerrar panel de detalle"
          className="cursor-pointer text-muted-foreground"
          onClick={onClose}
          type="button"
        >
          ✕
        </button>
      </div>
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Habitación</dt>
          <dd className="font-medium">{item.room}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Fechas</dt>
          <dd className="font-medium">
            {item.checkIn} → {item.checkOut}
          </dd>
        </div>
        {item.kind !== "block" ? (
          <div>
            <dt className="text-muted-foreground">Huésped</dt>
            <dd className="font-medium">{item.guestName}</dd>
          </div>
        ) : null}
        {item.kind === "reservation" && item.origin ? (
          <div>
            <dt className="text-muted-foreground">Origen</dt>
            <dd className="flex items-center gap-1.5 font-medium">
              <OriginIcon accessibleLabel origin={item.origin} />
              {originLabels[item.origin]}
            </dd>
          </div>
        ) : null}
        {item.kind === "reservation" && item.status ? (
          <div>
            <dt className="text-muted-foreground">Estado</dt>
            <dd className="font-medium">{item.status}</dd>
          </div>
        ) : null}
        {item.kind === "block" ? (
          <div>
            <dt className="text-muted-foreground">Motivo</dt>
            <dd className="font-medium">{item.reason}</dd>
          </div>
        ) : null}
      </dl>
      {item.kind === "reservation" ? (
        <Link
          className="inline-block min-h-11 rounded-md bg-accent px-4 py-2 text-center text-sm font-semibold text-on-accent"
          href={`/admin/reservas/${item.sourceId}`}
        >
          Ver reserva completa
        </Link>
      ) : null}
      {item.kind === "block" ? (
        <Link
          className="inline-block min-h-11 rounded-md bg-accent px-4 py-2 text-center text-sm font-semibold text-on-accent"
          href="/admin/bloqueos"
        >
          Ver bloqueos
        </Link>
      ) : null}
      {item.kind === "hold" ? (
        <p className="text-sm text-muted-foreground">
          Se libera automáticamente si el huésped no confirma la reserva.
        </p>
      ) : null}
    </div>
  );
}

function QuickCreateContent({
  selection,
  onClose,
}: Readonly<{ selection: EmptySelection; onClose: () => void }>) {
  const nextDay = addLodgingDays(selection.date, 1);
  const roomQuery = selection.roomId
    ? `&roomId=${selection.roomId}`
    : "";
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-heading text-lg font-semibold">
          {selection.roomName ? `${selection.roomName} · ` : ""}
          {selection.date}
        </h2>
        <button
          aria-label="Cerrar"
          className="cursor-pointer text-muted-foreground"
          onClick={onClose}
          type="button"
        >
          ✕
        </button>
      </div>
      <div className="flex flex-col gap-2">
        <Link
          className="min-h-11 rounded-md bg-accent px-4 py-2 text-center text-sm font-semibold text-on-accent"
          href={`/admin/reservas/nueva?checkIn=${selection.date}&checkOut=${nextDay}${roomQuery}`}
        >
          Nueva reserva
        </Link>
        <Link
          className="min-h-11 rounded-md border border-border px-4 py-2 text-center text-sm font-semibold"
          href={`/admin/bloqueos?checkIn=${selection.date}&checkOut=${nextDay}${roomQuery}`}
        >
          Nuevo bloqueo
        </Link>
      </div>
    </div>
  );
}

export function AdminCalendarView({
  activeRoomFilter,
  basePath,
  calendar,
  granularity,
  range,
  rooms,
  searchParams,
  today,
}: Readonly<{
  /** Set only when the room filter narrows the calendar to a single room (see calendar-toolbar.tsx). */
  activeRoomFilter?: CalendarRoom;
  basePath: string;
  calendar: Readonly<{ items: readonly AdminCalendarItem[] }>;
  granularity: CalendarGranularity;
  range: CalendarRange;
  rooms: readonly CalendarRoom[];
  searchParams: Readonly<Record<string, string | undefined>>;
  today: string;
}>) {
  const [detailItem, setDetailItem] = useState<AdminCalendarItem | null>(null);
  const [quickCreate, setQuickCreate] = useState<EmptySelection | null>(null);
  const [dayDetail, setDayDetail] = useState<Readonly<{
    date: string;
    items: readonly AdminCalendarItem[];
  }> | null>(null);
  const days = useMemo(
    () => enumerateDays(range.checkIn, range.checkOut),
    [range.checkIn, range.checkOut]
  );
  const grouped = useMemo(
    () => groupItemsByRoom(calendar.items),
    [calendar.items]
  );
  const showCompressed = range.preset === "month" && granularity === "weekly";
  const usesClassicGrid = range.preset !== "next_7_days";
  // `calendar.items` may include the classic grid's spillover days from an
  // adjacent month (see classicGridQueryWindow); the empty-state message is
  // about the visible range only, so it checks overlap with `range`, not
  // the raw item count.
  const hasItemsInRange = calendar.items.some(
    (item) => item.checkIn < range.checkOut && item.checkOut > range.checkIn
  );

  if (rooms.length === 0) {
    return (
      <p className="text-muted-foreground" role="status">
        No hay habitaciones activas para mostrar en el calendario.
      </p>
    );
  }

  return (
    <section aria-labelledby="calendar-title" className="space-y-4">
      <h1
        className="font-heading text-display text-primary"
        id="calendar-title"
      >
        Calendario por habitación
      </h1>
      <CalendarLegend />
      <CalendarRangeTransition
        rangeKey={`${range.checkIn}-${range.checkOut}-${granularity}`}
      >
        {showCompressed ? (
          <CompressedMonthGrid
            basePath={basePath}
            days={days}
            grouped={grouped}
            range={range}
            rooms={rooms}
            searchParams={searchParams}
          />
        ) : (
          <>
            <MobileAgenda
              days={days}
              grouped={grouped}
              onSelectEmpty={setQuickCreate}
              onSelectItem={setDetailItem}
              rooms={rooms}
              today={today}
            />
            {usesClassicGrid ? (
              <ClassicCalendarGrid
                activeRoomFilter={activeRoomFilter}
                grouped={grouped}
                onSelectDayOverflow={(date, items) => setDayDetail({ date, items })}
                onSelectEmpty={setQuickCreate}
                onSelectItem={setDetailItem}
                range={range}
                rooms={rooms}
                today={today}
              />
            ) : (
              <DesktopTimeline
                days={days}
                grouped={grouped}
                onSelectEmpty={setQuickCreate}
                onSelectItem={setDetailItem}
                rooms={rooms}
                today={today}
              />
            )}
          </>
        )}
      </CalendarRangeTransition>
      {!hasItemsInRange ? (
        <p className="text-sm text-muted-foreground" role="status">
          No hay reservas, retenciones ni bloqueos en este rango.
        </p>
      ) : null}
      {detailItem ? (
        <CalendarDetailSheet onClose={() => setDetailItem(null)}>
          <DetailPanelContent
            item={detailItem}
            onClose={() => setDetailItem(null)}
          />
        </CalendarDetailSheet>
      ) : null}
      {quickCreate ? (
        <CalendarDetailSheet
          onClose={() => setQuickCreate(null)}
          origin="bottom"
        >
          <QuickCreateContent
            onClose={() => setQuickCreate(null)}
            selection={quickCreate}
          />
        </CalendarDetailSheet>
      ) : null}
      {dayDetail && !detailItem ? (
        <CalendarDetailSheet onClose={() => setDayDetail(null)}>
          <DayDetailContent
            date={dayDetail.date}
            items={dayDetail.items}
            onClose={() => setDayDetail(null)}
            onSelectItem={(item) => {
              setDayDetail(null);
              setDetailItem(item);
            }}
          />
        </CalendarDetailSheet>
      ) : null}
    </section>
  );
}
