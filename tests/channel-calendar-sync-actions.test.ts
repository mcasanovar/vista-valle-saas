import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdministrator: vi.fn(),
  revalidatePath: vi.fn(),
  createPendingConnection: vi.fn(),
  setPlatformPaused: vi.fn(),
  connectionStore: vi.fn(),
}));

vi.mock("@/infrastructure/auth/authorization", () => ({
  requireAdministrator: mocks.requireAdministrator,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/features/channel-calendar-sync/store", () => ({
  getChannelConnectionStore: mocks.connectionStore,
}));

import {
  createBookingChannelConnectionAction,
  setChannelPlatformPausedAction,
} from "@/features/channel-calendar-sync/actions";

describe("createBookingChannelConnectionAction", () => {
  beforeEach(() => {
    mocks.createPendingConnection.mockClear();
    mocks.requireAdministrator.mockResolvedValue({
      user: { id: "admin-1" },
    });
    mocks.connectionStore.mockReturnValue({
      createPendingConnection: mocks.createPendingConnection,
    });
    mocks.createPendingConnection.mockResolvedValue({
      id: "conn-1",
      roomId: "room-1",
      platform: "booking",
      paymentBehavior: "pay_at_property",
      hasInboundFeedUrl: false,
      outboundToken: "token-1",
      enabled: false,
    });
  });

  it("always creates the connection as booking, ignoring any platform field on the form", async () => {
    const data = new FormData();
    data.set("roomId", "room-1");
    data.set("platform", "airbnb"); // tampered/irrelevant: must be ignored

    await createBookingChannelConnectionAction(data);

    expect(mocks.createPendingConnection).toHaveBeenCalledWith(
      "room-1",
      "booking",
      "pay_at_property"
    );
  });

  it("requires administrator authorization before creating anything", async () => {
    mocks.requireAdministrator.mockRejectedValueOnce(new Error("unauthorized"));
    const data = new FormData();
    data.set("roomId", "room-1");

    await expect(createBookingChannelConnectionAction(data)).rejects.toThrow(
      "unauthorized"
    );
    expect(mocks.createPendingConnection).not.toHaveBeenCalled();
  });

  it("rejects when no room is given", async () => {
    await expect(
      createBookingChannelConnectionAction(new FormData())
    ).rejects.toThrow("Indica la habitación.");
    expect(mocks.createPendingConnection).not.toHaveBeenCalled();
  });
});

describe("setChannelPlatformPausedAction", () => {
  beforeEach(() => {
    mocks.setPlatformPaused.mockClear();
    mocks.requireAdministrator.mockResolvedValue({
      user: { id: "admin-1" },
    });
    mocks.connectionStore.mockReturnValue({
      setPlatformPaused: mocks.setPlatformPaused,
    });
    mocks.setPlatformPaused.mockResolvedValue({
      platform: "airbnb",
      paused: true,
    });
  });

  it("requires administrator authorization before pausing anything", async () => {
    mocks.requireAdministrator.mockRejectedValueOnce(new Error("unauthorized"));
    const data = new FormData();
    data.set("platform", "airbnb");
    data.set("paused", "true");

    await expect(setChannelPlatformPausedAction(data)).rejects.toThrow(
      "unauthorized"
    );
    expect(mocks.setPlatformPaused).not.toHaveBeenCalled();
  });

  it("pauses the given platform", async () => {
    const data = new FormData();
    data.set("platform", "airbnb");
    data.set("paused", "true");

    await setChannelPlatformPausedAction(data);

    expect(mocks.setPlatformPaused).toHaveBeenCalledWith("airbnb", true);
  });

  it("rejects an invalid platform", async () => {
    const data = new FormData();
    data.set("platform", "vrbo");
    data.set("paused", "true");

    await expect(setChannelPlatformPausedAction(data)).rejects.toThrow(
      "Plataforma inválida"
    );
    expect(mocks.setPlatformPaused).not.toHaveBeenCalled();
  });
});
