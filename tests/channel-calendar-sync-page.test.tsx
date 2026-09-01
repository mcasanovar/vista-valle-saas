import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  tasks: vi.fn(),
  rooms: vi.fn(),
  connections: vi.fn(),
}));
vi.mock("@/features/channel-sync/actions", () => ({
  completeChannelSyncTaskAction: vi.fn(),
}));
vi.mock("@/features/channel-sync/tasks", () => ({
  getChannelSyncTasks: mocks.tasks,
}));
vi.mock("@/features/channel-calendar-sync/actions", () => ({
  saveChannelConnectionAction: vi.fn(),
  regenerateChannelConnectionTokenAction: vi.fn(),
}));
vi.mock("@/features/channel-calendar-sync/connections", () => ({
  getChannelConnections: mocks.connections,
}));
vi.mock("@/features/rooms", () => ({ getRoomReadSource: mocks.rooms }));

import SyncPage from "../app/(admin-protected)/admin/sincronizaciones/page";

describe("Sincronizaciones page tabs", () => {
  beforeEach(() => {
    mocks.tasks.mockReturnValue({ pending: () => [] });
    mocks.rooms.mockResolvedValue({
      listActive: () => [{ id: "room-1", name: "Habitación Roble" }],
    });
    mocks.connections.mockReturnValue({
      getByRoomAndPlatform: () => null,
    });
  });

  it("shows the manual queue tab by default and marks it as the current page", async () => {
    render(await SyncPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("link", { name: "Cola manual" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(
      screen.getByRole("link", { name: "Conexiones de canal" })
    ).not.toHaveAttribute("aria-current");
    expect(
      screen.getByRole("heading", { name: "Sincronizaciones pendientes" })
    ).toBeInTheDocument();
  });

  it("shows the connections tab when ?tab=conexiones is present, and links preserve it across reload", async () => {
    render(
      await SyncPage({ searchParams: Promise.resolve({ tab: "conexiones" }) })
    );
    expect(
      screen.getByRole("link", { name: "Conexiones de canal" })
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("heading", { name: "Conexiones de canal" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Cola manual" })
    ).toHaveAttribute("href", "?tab=cola");
    expect(
      screen.getByRole("link", { name: "Conexiones de canal" })
    ).toHaveAttribute("href", "?tab=conexiones");
  });
});
