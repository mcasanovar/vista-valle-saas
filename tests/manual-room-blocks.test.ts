import { describe, expect, it } from "vitest";

import { confirmPayAtPropertyBooking } from "@/features/reservations/confirm-pay-at-property";
import {
  confirmRoomBlocks,
  getManualRoomBlockAuditEvents,
  getManualRoomBlocks,
  reviewRoomBlocks,
  RoomBlockInputError,
} from "@/features/room-blocks/manual-blocks";

const guest = {
  room: "demo-room-terra",
  checkIn: "2030-01-10",
  checkOut: "2030-01-12",
  firstName: "Ana",
  lastName: "Pérez",
  email: "ana@example.com",
  phone: "123",
  guestCount: "1",
};

describe("manual room blocks", () => {
  it("rejects empty reasons and invalid intervals", async () => {
    const service = getManualRoomBlocks()!;
    await expect(
      service.create(
        {
          roomId: "demo-room-terra",
          checkIn: "2030-01-01",
          checkOut: "2030-01-02",
          reason: " ",
        },
        "admin-1"
      )
    ).rejects.toThrow();
    await expect(
      service.create(
        {
          roomId: "demo-room-terra",
          checkIn: "2030-01-02",
          checkOut: "2030-01-01",
          reason: "maintenance",
        },
        "admin-1"
      )
    ).rejects.toThrow();
  });

  it("blocks public reservations and releases the interval on removal with audit", async () => {
    const service = getManualRoomBlocks()!;
    const block = await service.create(
      {
        roomId: "demo-room-terra",
        checkIn: guest.checkIn,
        checkOut: guest.checkOut,
        reason: "maintenance",
      },
      "admin-1"
    );
    await expect(confirmPayAtPropertyBooking(guest)).rejects.toThrow();
    await service.remove(block.id, "admin-2");
    await expect(confirmPayAtPropertyBooking(guest)).resolves.toBeDefined();
    expect(
      getManualRoomBlockAuditEvents().filter(
        (event) => event.blockId === block.id
      )
    ).toMatchObject([
      { action: "created", actor: "admin-1" },
      { action: "removed", actor: "admin-2" },
    ]);
  });
  it("rejects a block that overlaps an existing public reservation", async () => {
    const reservation = {
      ...guest,
      room: "demo-room-andes",
      checkIn: "2030-02-10",
      checkOut: "2030-02-12",
    };
    await confirmPayAtPropertyBooking(reservation);
    await expect(
      getManualRoomBlocks()!.create(
        {
          roomId: "demo-room-andes",
          checkIn: reservation.checkIn,
          checkOut: reservation.checkOut,
          reason: "maintenance",
        },
        "admin-1"
      )
    ).rejects.toThrow();
  });
  it("creates multiple blocks atomically and leaves no partial selection on conflict", async () => {
    const service = getManualRoomBlocks()!;
    const before = service.list().length;
    await service.create(
      {
        roomId: "demo-room-valle",
        checkIn: "2035-01-10",
        checkOut: "2035-01-12",
        reason: "existing",
      },
      "admin-1"
    );
    await expect(
      service.createMany(
        {
          roomIds: ["demo-room-terra", "demo-room-valle"],
          checkIn: "2035-01-10",
          checkOut: "2035-01-12",
          reason: "maintenance",
        },
        "admin-1"
      )
    ).rejects.toThrow();
    expect(
      service.list().filter((block) => block.checkIn === "2035-01-10")
    ).toHaveLength(1);
    expect(service.list().length).toBe(before + 1);
  });
  it("allows exactly one of two concurrent overlapping creates", async () => {
    const service = getManualRoomBlocks()!;
    const checkIn = "2042-01-10";
    const checkOut = "2042-01-12";
    const results = await Promise.allSettled([
      service.createMany(
        {
          roomIds: ["demo-room-terra"],
          checkIn,
          checkOut,
          reason: "concurrent-a",
        },
        "admin-1"
      ),
      service.createMany(
        {
          roomIds: ["demo-room-terra"],
          checkIn,
          checkOut,
          reason: "concurrent-b",
        },
        "admin-2"
      ),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(
      service.list().filter(
        (block) =>
          block.roomId === "demo-room-terra" && block.checkIn === checkIn
      )
    ).toHaveLength(1);
  });
  it("filters paginated history and preserves detail audit", async () => {
    const service = getManualRoomBlocks()!;
    const first = await service.create(
      {
        roomId: "demo-room-terra",
        checkIn: "2040-03-01",
        checkOut: "2040-03-03",
        reason: "Mantención techo",
      },
      "admin-a"
    );
    const second = await service.create(
      {
        roomId: "demo-room-valle",
        checkIn: "2040-03-03",
        checkOut: "2040-03-05",
        reason: "Limpieza",
      },
      "admin-a"
    );
    await service.remove(first.id, "admin-b");
    expect(
      service
        .listPage({
          status: "active",
          roomId: "demo-room-valle",
          reason: "limp",
          page: 1,
          pageSize: 1,
        })
        .items.map((block) => block.id)
    ).toEqual([second.id]);
    expect(
      service.listPage({
        status: "removed",
        checkIn: "2040-03-01",
        checkOut: "2040-03-03",
      }).total
    ).toBeGreaterThan(0);
    expect(
      service
        .listPage({
          status: "all",
          checkIn: "2040-03-03",
          checkOut: "2040-03-05",
        })
        .items.some((block) => block.id === first.id)
    ).toBe(false);
    expect(service.detail(first.id)).toMatchObject({
      nights: 2,
      audit: [
        { action: "created", actor: "admin-a" },
        { action: "removed", actor: "admin-b" },
      ],
    });
  });
  it("rejects unknown rooms without writes", async () => {
    const service = getManualRoomBlocks()!;
    const before = service.list().length;
    const auditsBefore = getManualRoomBlockAuditEvents().length;
    await expect(
      service.createMany(
        {
          roomIds: ["unknown-room"],
          checkIn: "2041-01-01",
          checkOut: "2041-01-02",
          reason: "x",
        },
        "admin-1"
      )
    ).rejects.toThrow();
    expect(service.list()).toHaveLength(before);
    expect(getManualRoomBlockAuditEvents()).toHaveLength(auditsBefore);
  });
  it("normalizes invalid page sizes and honors positive page sizes", async () => {
    const service = getManualRoomBlocks()!;
    expect(service.listPage({ pageSize: 0 }).pageSize).toBe(20);
    expect(service.listPage({ pageSize: 1 }).pageSize).toBe(1);
  });

  it("review reports a clear result when no room in the interval overlaps", async () => {
    await expect(
      reviewRoomBlocks({
        roomIds: ["demo-room-terra"],
        checkIn: "2036-05-10",
        checkOut: "2036-05-12",
        reason: "maintenance",
      })
    ).resolves.toEqual({ kind: "clear", conflicts: [] });
  });

  it("review groups conflicting dates and rooms by an existing reservation without writing anything", async () => {
    const reservation = {
      ...guest,
      room: "demo-room-terra",
      checkIn: "2036-06-10",
      checkOut: "2036-06-12",
    };
    await confirmPayAtPropertyBooking(reservation);
    const before = getManualRoomBlocks()!.list().length;
    const auditsBefore = getManualRoomBlockAuditEvents().length;
    const review = await reviewRoomBlocks({
      roomIds: ["demo-room-terra", "demo-room-valle"],
      checkIn: "2036-06-10",
      checkOut: "2036-06-12",
      reason: "maintenance",
    });
    expect(review.kind).toBe("conflicts");
    if (review.kind !== "conflicts") throw new Error("expected conflicts");
    expect(review.conflicts).toEqual([
      expect.objectContaining({
        roomId: "demo-room-terra",
        date: "2036-06-10",
        source: "reservation",
      }),
      expect.objectContaining({
        roomId: "demo-room-terra",
        date: "2036-06-11",
        source: "reservation",
      }),
    ]);
    expect(review.conflicts.some((c) => c.roomId === "demo-room-valle")).toBe(
      false
    );
    expect(getManualRoomBlocks()!.list().length).toBe(before);
    expect(getManualRoomBlockAuditEvents().length).toBe(auditsBefore);
  });

  it("review rejects unknown rooms without writing anything", async () => {
    await expect(
      reviewRoomBlocks({
        roomIds: ["unknown-room"],
        checkIn: "2036-07-10",
        checkOut: "2036-07-12",
        reason: "maintenance",
      })
    ).rejects.toThrow(RoomBlockInputError);
  });

  it("confirm creates all selected rooms despite a conflict, leaves the reservation untouched, and audits the override", async () => {
    const reservation = {
      ...guest,
      room: "demo-room-terra",
      checkIn: "2037-01-10",
      checkOut: "2037-01-12",
    };
    await confirmPayAtPropertyBooking(reservation);
    const made = await confirmRoomBlocks(
      {
        roomIds: ["demo-room-terra", "demo-room-valle"],
        checkIn: "2037-01-10",
        checkOut: "2037-01-12",
        reason: "maintenance override",
      },
      "admin-1"
    );
    expect(made.map((block) => block.roomId).sort()).toEqual([
      "demo-room-terra",
      "demo-room-valle",
    ]);
    // The pre-existing reservation must still be able to be looked up as an
    // active occupant of the room; confirming a block never mutates it.
    await expect(
      confirmPayAtPropertyBooking(reservation)
    ).rejects.toThrow();
    for (const block of made)
      expect(getManualRoomBlockAuditEvents()).toContainEqual(
        expect.objectContaining({
          action: "created",
          blockId: block.id,
          confirmedWithConflicts: true,
        })
      );
  });

  it("confirm rejects unknown rooms without creating any block", async () => {
    const before = getManualRoomBlocks()!.list().length;
    await expect(
      confirmRoomBlocks(
        {
          roomIds: ["unknown-room"],
          checkIn: "2038-01-01",
          checkOut: "2038-01-02",
          reason: "maintenance",
        },
        "admin-1"
      )
    ).rejects.toThrow(RoomBlockInputError);
    expect(getManualRoomBlocks()!.list().length).toBe(before);
  });
});
