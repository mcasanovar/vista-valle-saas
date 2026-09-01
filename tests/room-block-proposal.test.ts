import { describe, expect, it } from "vitest";
import { mockDemoRooms } from "@/features/rooms";
import {
  parseCreateRoomBlockProposal,
  unsupportedAssistantActions,
} from "@/features/assistant/room-block-proposal";
describe("CREATE_ROOM_BLOCK contract", () => {
  it("accepts a compliant Spanish proposal and resolves a real alias", () => {
    expect(
      parseCreateRoomBlockProposal(
        {
          action: "CREATE_ROOM_BLOCK",
          room: "habitacion-valle-demo",
          checkIn: "2041-01-01",
          checkOut: "2041-01-03",
          reason: "mantenimiento",
        },
        mockDemoRooms
      )
    ).toMatchObject({ roomId: "demo-room-valle" });
    expect(
      parseCreateRoomBlockProposal(
        {
          action: "CREATE_ROOM_BLOCK",
          room: "HABITACIÓN INDIVIDUAL",
          checkIn: "2041-02-01",
          checkOut: "2041-02-02",
          reason: "mantenimiento",
        },
        mockDemoRooms
      )
    ).toMatchObject({ roomId: "demo-room-valle" });
  });
  it("rejects omitted and invented rooms without proposing a mutation", () => {
    expect(() =>
      parseCreateRoomBlockProposal(
        {
          action: "CREATE_ROOM_BLOCK",
          checkIn: "2041-01-01",
          checkOut: "2041-01-03",
          reason: "x",
        },
        mockDemoRooms
      )
    ).toThrow();
    expect(() =>
      parseCreateRoomBlockProposal(
        {
          action: "CREATE_ROOM_BLOCK",
          room: "inventada",
          checkIn: "2041-01-01",
          checkOut: "2041-01-03",
          reason: "x",
        },
        mockDemoRooms
      )
    ).toThrow();
  });
  it("rejects every unsupported action rather than producing a proposal", () => {
    expect(() =>
      parseCreateRoomBlockProposal(
        { action: "CANCEL_RESERVATION" },
        mockDemoRooms
      )
    ).toThrow();
    expect(unsupportedAssistantActions).toEqual(
      expect.arrayContaining([
        "CANCEL_RESERVATION",
        "CHANGE_PRICE",
        "CHANGE_PAYMENT",
        "ARBITRARY_SQL",
      ])
    );
  });
});
