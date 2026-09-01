import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ChannelConnectionsPanel,
  type RoomConnectionCards,
} from "@/features/channel-calendar-sync/connections-panel";

function roomWith(cards: RoomConnectionCards["cards"]): RoomConnectionCards {
  return { roomId: "room-1", roomName: "Habitación Roble", cards };
}

describe("ChannelConnectionsPanel", () => {
  it("renders the configuration form for a platform with no connection (Sin conectar)", () => {
    render(
      <ChannelConnectionsPanel
        rooms={[
          roomWith([
            { roomId: "room-1", platform: "airbnb", connection: null, outboundUrl: null },
          ]),
        ]}
        save={vi.fn()}
        regenerate={vi.fn()}
      />
    );
    expect(screen.getByText("○ Sin conectar")).toBeInTheDocument();
    expect(
      screen.getByLabelText("URL del feed de Airbnb")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Configurar conexión" })
    ).toBeInTheDocument();
  });

  it("renders the outbound link, regenerate control, and sync status for an active connection", () => {
    render(
      <ChannelConnectionsPanel
        rooms={[
          roomWith([
            {
              roomId: "room-1",
              platform: "airbnb",
              connection: {
                id: "conn-1",
                outboundToken: "token-abc",
                paymentBehavior: "auto_approved",
                lastPolledAt: new Date("2026-09-01T12:00:00Z"),
                lastPollStatus: "ok",
                lastPollEventCount: 2,
              },
              outboundUrl: "https://vistavalle.cl/api/ical/token-abc",
            },
          ]),
        ]}
        save={vi.fn()}
        regenerate={vi.fn()}
      />
    );
    expect(screen.getByText("● Activa")).toBeInTheDocument();
    expect(
      screen.getByText("https://vistavalle.cl/api/ical/token-abc")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Regenerar link/ })
    ).toBeInTheDocument();
    expect(screen.getByText(/2 eventos/)).toBeInTheDocument();
    expect(
      screen.getByText(/se registra como aprobado automáticamente/)
    ).toBeInTheDocument();
    // No inbound URL field shown once saved — write-only after saving.
    expect(
      screen.queryByLabelText("URL del feed de Airbnb")
    ).not.toBeInTheDocument();
    expect(screen.getByText("configurado ✓")).toBeInTheDocument();
  });

  it("renders an error state with the poll error message", () => {
    render(
      <ChannelConnectionsPanel
        rooms={[
          roomWith([
            {
              roomId: "room-1",
              platform: "booking",
              connection: {
                id: "conn-2",
                outboundToken: "token-def",
                paymentBehavior: "pay_at_property",
                lastPolledAt: new Date("2026-09-01T12:00:00Z"),
                lastPollStatus: "error",
                lastPollError: "Inbound feed request failed with status 503",
              },
              outboundUrl: "https://vistavalle.cl/api/ical/token-def",
            },
          ]),
        ]}
        save={vi.fn()}
        regenerate={vi.fn()}
      />
    );
    expect(screen.getByText("⚠ Con error")).toBeInTheDocument();
    expect(
      screen.getByText("Inbound feed request failed with status 503")
    ).toBeInTheDocument();
  });

  it("lets the admin reopen the form via Reemplazar without exposing the previous URL", async () => {
    const user = userEvent.setup();
    render(
      <ChannelConnectionsPanel
        rooms={[
          roomWith([
            {
              roomId: "room-1",
              platform: "airbnb",
              connection: {
                id: "conn-1",
                outboundToken: "token-abc",
                paymentBehavior: "auto_approved",
              },
              outboundUrl: "https://vistavalle.cl/api/ical/token-abc",
            },
          ]),
        ]}
        save={vi.fn()}
        regenerate={vi.fn()}
      />
    );
    await user.click(screen.getByRole("button", { name: "Reemplazar" }));
    const field = screen.getByLabelText("URL del feed de Airbnb");
    expect(field).toHaveValue("");
  });
});
