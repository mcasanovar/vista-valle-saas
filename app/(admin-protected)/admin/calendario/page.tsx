import {
  getAdminCalendar,
  isKnownReservationOrigin,
} from "@/features/admin/calendar";
import {
  calendarRangeForAnchor,
  classicGridQueryWindow,
  defaultCalendarRange,
  parseCalendarGranularity,
  parseCalendarRangePreset,
} from "@/features/admin/calendar-range";
import { CalendarToolbar } from "@/features/admin/calendar-toolbar";
import { AdminCalendarView } from "@/features/admin/calendar-view";
import {
  isValidLodgingDate,
  lodgingToday,
  parseLodgingDate,
} from "@/features/availability";
import { getRoomReadSource } from "@/features/rooms";

const BASE_PATH = "/admin/calendario";

type CalendarQuery = Readonly<{
  checkIn?: string;
  preset?: string;
  granularity?: string;
  roomId?: string;
  origin?: string;
}>;

export const dynamic = "force-dynamic";

export default async function CalendarPage({
  searchParams,
}: Readonly<{ searchParams: Promise<CalendarQuery> }>) {
  const query = await searchParams;
  const preset = parseCalendarRangePreset(query.preset);
  const range =
    query.checkIn && isValidLodgingDate(query.checkIn)
      ? calendarRangeForAnchor(preset, parseLodgingDate(query.checkIn))
      : defaultCalendarRange();
  const granularity = parseCalendarGranularity(query.granularity);
  const origin =
    query.origin && isKnownReservationOrigin(query.origin)
      ? query.origin
      : undefined;
  const roomId = query.roomId || undefined;
  // The classic calendar grid (Mes/Semana/2 semanas) pads its rows out to
  // full Monday-start weeks, so it needs occupancy for those spillover days
  // too - see classicGridQueryWindow. Próximos 7 días keeps its exact
  // rolling window (it renders the room timeline, not the grid).
  const dataWindow =
    range.preset === "next_7_days" ? range : classicGridQueryWindow(range);

  const [calendar, roomSource] = await Promise.all([
    getAdminCalendar({
      checkIn: dataWindow.checkIn,
      checkOut: dataWindow.checkOut,
      origin,
      roomId,
    }),
    getRoomReadSource(),
  ]);

  const allRooms = roomSource
    .listActive()
    .map((room) => ({ id: room.id, name: room.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const visibleRooms = roomId
    ? allRooms.filter((room) => room.id === roomId)
    : allRooms;
  const activeRoomFilter =
    roomId && visibleRooms.length === 1 ? visibleRooms[0] : undefined;

  return (
    <div className="space-y-4">
      <CalendarToolbar
        basePath={BASE_PATH}
        granularity={granularity}
        range={range}
        rooms={allRooms}
        searchParams={query}
      />
      <AdminCalendarView
        activeRoomFilter={activeRoomFilter}
        basePath={BASE_PATH}
        calendar={calendar}
        granularity={granularity}
        range={range}
        rooms={visibleRooms}
        searchParams={query}
        today={lodgingToday()}
      />
    </div>
  );
}
