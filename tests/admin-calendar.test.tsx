import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminCalendarView } from "@/features/admin/calendar-view";
import { defaultCalendarRange } from "@/features/admin/calendar-range";
import type { AdminCalendarItem } from "@/infrastructure/database/admin-calendar-source";

const range = defaultCalendarRange(new Date("2026-10-15T12:00:00Z"));

const items: readonly AdminCalendarItem[] = [
  {
    checkIn: "2026-10-05",
    checkOut: "2026-10-08",
    guestName: "María González",
    id: "reservation-r1-room-valle",
    kind: "reservation",
    origin: "website",
    room: "Habitación Valle",
    roomId: "room-valle",
    sourceId: "r1",
    status: "confirmed",
  },
  {
    checkIn: "2026-10-08",
    checkOut: "2026-10-10",
    guestName: "Pedro Soto",
    id: "hold-h1",
    kind: "hold",
    room: "Habitación Andes",
    roomId: "room-andes",
    sourceId: "h1",
  },
  {
    checkIn: "2026-10-11",
    checkOut: "2026-10-13",
    id: "block-b1",
    kind: "block",
    reason: "Mantención",
    room: "Habitación Terra",
    roomId: "room-terra",
    sourceId: "b1",
  },
];

const rooms = [
  { id: "room-valle", name: "Habitación Valle" },
  { id: "room-andes", name: "Habitación Andes" },
  { id: "room-terra", name: "Habitación Terra" },
];

function renderCalendar(overrides: Partial<Parameters<typeof AdminCalendarView>[0]> = {}) {
  return render(
    <AdminCalendarView
      basePath="/admin/calendario"
      calendar={{ items }}
      granularity="daily"
      range={range}
      rooms={rooms}
      searchParams={{}}
      today="2026-10-15"
      {...overrides}
    />
  );
}

describe("admin calendar view", () => {
  it("renders the legend and one bar per room/kind", () => {
    renderCalendar();
    expect(screen.getByLabelText("Leyenda")).toBeVisible();
    expect(screen.getAllByText("María González").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pedro Soto").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Mantención").length).toBeGreaterThan(0);
  });

  it("opens a detail panel linking to the reservation's real id, not the composite bar id", () => {
    renderCalendar();
    const [bar] = screen.getAllByText("María González");
    fireEvent.click(bar!.closest("button")!);
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("link", { name: "Ver reserva completa" })
    ).toHaveAttribute("href", "/admin/reservas/r1");
  });

  it("shows no link for a hold's detail (no hold detail page exists)", () => {
    renderCalendar();
    const [bar] = screen.getAllByText("Pedro Soto");
    fireEvent.click(bar!.closest("button")!);
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).queryByRole("link", { name: /Ver/ })
    ).not.toBeInTheDocument();
  });

  it("opens quick-create from an empty day cell in the classic grid without a room preselected, unless a room filter is active", () => {
    renderCalendar();
    const emptyDay = screen.getByRole("button", {
      name: "Crear reserva o bloqueo el 2026-10-20",
    });
    fireEvent.click(emptyDay);
    const dialog = screen.getByRole("dialog");
    const newReservation = within(dialog).getByRole("link", {
      name: "Nueva reserva",
    });
    const newBlock = within(dialog).getByRole("link", { name: "Nuevo bloqueo" });
    expect(newReservation.getAttribute("href")).not.toContain("roomId=");
    expect(newBlock.getAttribute("href")).not.toContain("roomId=");
    expect(newReservation.getAttribute("href")).toContain("checkIn=2026-10-20");
  });

  it("prefills the room in quick-create when a room filter is active", () => {
    renderCalendar({
      activeRoomFilter: { id: "room-valle", name: "Habitación Valle" },
      rooms: [rooms[0]!],
    });
    const emptyDay = screen.getByRole("button", {
      name: "Crear reserva o bloqueo para Habitación Valle el 2026-10-20",
    });
    fireEvent.click(emptyDay);
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("link", { name: "Nueva reserva" })
    ).toHaveAttribute("href", expect.stringContaining("roomId=room-valle"));
  });

  it("opens a day-detail sheet from the '+N más' overflow indicator, which then opens an item's own detail", () => {
    const denseDay = "2026-10-05";
    const denseItems: readonly AdminCalendarItem[] = [
      "room-valle",
      "room-andes",
      "room-terra",
      "room-sur",
    ].map((roomId, index) => ({
      checkIn: denseDay,
      checkOut: "2026-10-06",
      guestName: `Huésped ${index}`,
      id: `reservation-${roomId}`,
      kind: "reservation",
      origin: "website",
      room: `Habitación ${index}`,
      roomId,
      sourceId: `res-${roomId}`,
      status: "confirmed",
    }));
    renderCalendar({
      calendar: { items: denseItems },
      rooms: [...rooms, { id: "room-sur", name: "Habitación Sur" }],
    });
    fireEvent.click(screen.getByRole("button", { name: "+1 más" }));
    const dayDialog = screen.getByRole("dialog");
    expect(within(dayDialog).getByText("Huésped 3")).toBeVisible();
    fireEvent.click(within(dayDialog).getByText("Huésped 0").closest("button")!);
    const detailDialog = screen.getByRole("dialog");
    expect(
      within(detailDialog).getByRole("link", { name: "Ver reserva completa" })
    ).toHaveAttribute("href", "/admin/reservas/res-room-valle");
  });

  it("reports an explicit empty state distinct from unavailability", () => {
    render(
      <AdminCalendarView
        basePath="/admin/calendario"
        calendar={{ items: [] }}
        granularity="daily"
        range={range}
        rooms={rooms}
        searchParams={{}}
        today="2026-10-15"
      />
    );
    expect(
      screen.getByText("No hay reservas, retenciones ni bloqueos en este rango.")
    ).toBeVisible();
  });
});
