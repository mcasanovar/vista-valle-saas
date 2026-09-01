import { describe, expect, it } from "vitest";
import { confirmPayAtPropertyBooking } from "@/features/reservations/confirm-pay-at-property";
import {
  cancelBlockProposalToken,
  createBlockProposalToken,
  executeBlockProposalToken,
} from "@/features/assistant/proposal-tokens";
import { getManualRoomBlocks } from "@/features/room-blocks/manual-blocks";
describe("block proposal tokens", () => {
  it("executes once and blocks overlapping public booking", async () => {
    const proposal = createBlockProposalToken({
      roomId: "demo-room-valle",
      checkIn: "2045-01-01",
      checkOut: "2045-01-03",
      reason: "maintenance",
      actor: "admin-1",
    });
    await executeBlockProposalToken(proposal.token, "admin-1");
    await expect(
      confirmPayAtPropertyBooking({
        room: "demo-room-valle",
        checkIn: "2045-01-01",
        checkOut: "2045-01-03",
        firstName: "Ana",
        lastName: "Pérez",
        email: "ana@example.com",
        phone: "123",
        guestCount: 1,
      })
    ).rejects.toThrow();
    await expect(
      executeBlockProposalToken(proposal.token, "admin-1")
    ).rejects.toThrow();
  });
  it("rejects expiry other actor altered and cancelled tokens", async () => {
    const countBeforeInvalidTokens = getManualRoomBlocks()!.list().length;
    const expired = createBlockProposalToken(
      {
        roomId: "demo-room-andes",
        checkIn: "2045-02-01",
        checkOut: "2045-02-03",
        reason: "x",
        actor: "admin-1",
      },
      -1
    );
    await expect(
      executeBlockProposalToken(expired.token, "admin-1")
    ).rejects.toThrow();
    const other = createBlockProposalToken({
      roomId: "demo-room-andes",
      checkIn: "2045-03-01",
      checkOut: "2045-03-03",
      reason: "x",
      actor: "admin-1",
    });
    await expect(
      executeBlockProposalToken(other.token, "admin-2")
    ).rejects.toThrow();
    await expect(
      executeBlockProposalToken("altered", "admin-1")
    ).rejects.toThrow();
    cancelBlockProposalToken(other.token, "admin-1");
    await expect(
      executeBlockProposalToken(other.token, "admin-1")
    ).rejects.toThrow();
    expect(getManualRoomBlocks()!.list()).toHaveLength(
      countBeforeInvalidTokens
    );
  });
  it("rejects execution when a public reservation already occupies the room", async () => {
    await confirmPayAtPropertyBooking({
      room: "demo-room-andes",
      checkIn: "2045-04-01",
      checkOut: "2045-04-03",
      firstName: "Ana",
      lastName: "Pérez",
      email: "ana@example.com",
      phone: "123",
      guestCount: 1,
    });
    const proposal = createBlockProposalToken({
      roomId: "demo-room-andes",
      checkIn: "2045-04-01",
      checkOut: "2045-04-03",
      reason: "maintenance",
      actor: "admin-1",
    });
    await expect(
      executeBlockProposalToken(proposal.token, "admin-1")
    ).rejects.toThrow();
    expect(
      getManualRoomBlocks()!
        .list()
        .some(
          (block) =>
            block.roomId === "demo-room-andes" && block.checkIn === "2045-04-01"
        )
    ).toBe(false);
  });
});
