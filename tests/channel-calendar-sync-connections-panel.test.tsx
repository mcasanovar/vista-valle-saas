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

  it("offers to generate our link first for a disconnected Booking card, but not for Airbnb", () => {
    render(
      <ChannelConnectionsPanel
        rooms={[
          roomWith([
            { roomId: "room-1", platform: "airbnb", connection: null, outboundUrl: null },
            { roomId: "room-1", platform: "booking", connection: null, outboundUrl: null },
          ]),
        ]}
        save={vi.fn()}
        regenerate={vi.fn()}
        createPendingConnection={vi.fn()}
      />
    );
    expect(
      screen.getAllByRole("button", { name: "Generar nuestro link para Booking" })
    ).toHaveLength(1);
  });

  it("does not offer to generate a link when createPendingConnection is not provided", () => {
    render(
      <ChannelConnectionsPanel
        rooms={[
          roomWith([
            { roomId: "room-1", platform: "booking", connection: null, outboundUrl: null },
          ]),
        ]}
        save={vi.fn()}
        regenerate={vi.fn()}
      />
    );
    expect(
      screen.queryByRole("button", { name: "Generar nuestro link para Booking" })
    ).not.toBeInTheDocument();
  });

  it("shows the outbound link and the pending hint, and hides the generate button, for a Booking connection with no inbound feed URL saved yet", () => {
    render(
      <ChannelConnectionsPanel
        rooms={[
          roomWith([
            {
              roomId: "room-1",
              platform: "booking",
              connection: {
                id: "conn-3",
                outboundToken: "token-pending",
                paymentBehavior: "pay_at_property",
                hasInboundFeedUrl: false,
              },
              outboundUrl: "https://vistavalle.cl/api/ical/token-pending",
            },
          ]),
        ]}
        save={vi.fn()}
        regenerate={vi.fn()}
        createPendingConnection={vi.fn()}
      />
    );
    expect(screen.getByText("○ Sin conectar")).toBeInTheDocument();
    expect(
      screen.getByText("https://vistavalle.cl/api/ical/token-pending")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Pega ese link en Booking/)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Generar nuestro link para Booking" })
    ).not.toBeInTheDocument();
    // The inbound-URL form is already open, ready to receive Booking's link.
    expect(
      screen.getByLabelText("URL del feed de Booking")
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
