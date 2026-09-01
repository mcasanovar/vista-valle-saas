import { describe, expect, it } from "vitest";
import { mockDemoRooms } from "@/features/rooms";
import {
  isProposalExpired,
  missingProposalFields,
  resolveBlockProposal,
  resolveRoomAlias,
} from "@/features/assistant/proposal-resolution";
describe("block proposal resolution", () => {
  it("resolves real aliases and absolute dates", () => {
    const proposal = resolveBlockProposal(
      {
        room: "Habitación Individual",
        checkIn: "2043-01-01",
        checkOut: "2043-01-03",
        reason: "mantenimiento",
      },
      mockDemoRooms,
      new Date("2042-01-01")
    );
    expect(proposal).toMatchObject({ roomId: "demo-room-valle", nights: 2 });
  });
  it("identifies omitted rooms and rejects invented rooms without a preview", () => {
    expect(resolveRoomAlias("inventada", mockDemoRooms)).toBeNull();
    expect(missingProposalFields({ checkIn: "2043-01-01" })).toContain("room");
  });
  it("rejects missing years and Chilean relative dates", () => {
    expect(() =>
      resolveBlockProposal(
        {
          room: "habitacion-valle-demo",
          checkIn: "01/01",
          checkOut: "03/01",
          reason: "x",
        },
        mockDemoRooms
      )
    ).toThrow();
    expect(() =>
      resolveBlockProposal(
        {
          room: "habitacion-valle-demo",
          checkIn: "hoy",
          checkOut: "mañana",
          reason: "x",
        },
        mockDemoRooms
      )
    ).toThrow("Absolute year is required");
  });
  it("expires proposals", () => {
    const proposal = resolveBlockProposal(
      {
        room: "habitacion-valle-demo",
        checkIn: "2043-01-01",
        checkOut: "2043-01-03",
        reason: "x",
      },
      mockDemoRooms,
      new Date(0),
      1
    );
    expect(isProposalExpired(proposal, new Date(60001))).toBe(true);
  });
});
