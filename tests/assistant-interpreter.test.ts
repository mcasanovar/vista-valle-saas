import { afterEach, describe, expect, it, vi } from "vitest";
import { mockDemoRooms } from "@/features/rooms";
import {
  AssistantProviderUnavailableError,
  AssistantStructuredOutputError,
  createMockRoomBlockInterpreter,
  getRoomBlockInterpreter,
} from "@/features/assistant/interpreter";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("structured assistant interpreter", () => {
  it("returns validated structured proposal without network access", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const interpreter = createMockRoomBlockInterpreter({
      action: "CREATE_ROOM_BLOCK",
      room: "habitacion-valle-demo",
      checkIn: "2042-01-01",
      checkOut: "2042-01-03",
      reason: "mantenimiento",
    });
    await expect(
      interpreter.interpret("bloquea", mockDemoRooms)
    ).resolves.toMatchObject({ roomId: "demo-room-valle" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects malformed model output", async () => {
    const interpreter = createMockRoomBlockInterpreter("not json");
    await expect(
      interpreter.interpret("x", mockDemoRooms)
    ).rejects.toBeInstanceOf(AssistantStructuredOutputError);
  });
  it("returns a typed safe failure when no provider is configured", () => {
    expect(() => getRoomBlockInterpreter()).toThrow(
      AssistantProviderUnavailableError
    );
  });
});
