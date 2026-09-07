import { describe, expect, it } from "vitest";

import {
  getRoomImageAuditEvents,
  listRoomImages,
  removeRoomImage,
  reorderRoomImages,
  RoomImageInputError,
  setPrimaryRoomImage,
  uploadRoomImages,
} from "@/features/room-images";

function file(name: string, byte = 1) {
  return {
    altText: `Foto ${name}`,
    bytes: new Uint8Array([byte, byte, byte]),
    contentType: "image/webp",
    filename: `${name}.webp`,
  };
}

describe("room images (mock)", () => {
  it("rejects an unknown room before touching storage or the database", async () => {
    await expect(
      uploadRoomImages("not-a-real-room", [file("a")], "admin-1")
    ).rejects.toThrow(RoomImageInputError);
  });

  it("rejects the whole batch when one file is invalid, uploading nothing", async () => {
    await expect(
      uploadRoomImages(
        "demo-room-valle",
        [file("valid"), { ...file("bad"), contentType: "text/plain" }],
        "admin-1"
      )
    ).rejects.toThrow(RoomImageInputError);

    const before = await listRoomImages("demo-room-valle");
    expect(before.some((photo) => photo.altText === "Foto valid")).toBe(false);
  });

  it("uploads a batch, makes the first photo primary, and audits each upload", async () => {
    const uploaded = await uploadRoomImages(
      "demo-room-andes",
      [file("first"), file("second")],
      "admin-1"
    );

    expect(uploaded).toHaveLength(2);
    expect(uploaded[0]).toMatchObject({ isPrimary: true, position: 0 });
    expect(uploaded[1]).toMatchObject({ isPrimary: false, position: 1 });
    expect(uploaded[0]!.url).toContain(uploaded[0]!.storagePath);

    const events = getRoomImageAuditEvents().filter(
      (event) => event.roomId === "demo-room-andes" && event.action === "uploaded"
    );
    expect(events.length).toBeGreaterThanOrEqual(2);
  });

  it("promotes a different photo to primary and demotes the previous one", async () => {
    const [first, second] = await uploadRoomImages(
      "demo-room-terra",
      [file("one"), file("two")],
      "admin-1"
    );

    await setPrimaryRoomImage("demo-room-terra", second!.id, "admin-2");

    const after = await listRoomImages("demo-room-terra");
    expect(after.find((photo) => photo.id === second!.id)).toMatchObject({
      isPrimary: true,
      position: 0,
    });
    expect(after.find((photo) => photo.id === first!.id)).toMatchObject({
      isPrimary: false,
      position: 1,
    });
  });

  it("reorders secondary photos while keeping the primary first", async () => {
    const roomId = "demo-room-valle";
    const [primary, secondA, secondB] = await uploadRoomImages(
      roomId,
      [file("p"), file("a"), file("b")],
      "admin-1"
    );
    await setPrimaryRoomImage(roomId, primary!.id, "admin-1");

    await reorderRoomImages(roomId, [secondB!.id, secondA!.id], "admin-1");

    const order = (await listRoomImages(roomId)).map((photo) => photo.id);
    expect(order.slice(-2)).toEqual([secondB!.id, secondA!.id]);
    expect(order[0]).toBe(primary!.id);
  });

  it("rejects a reorder that does not match the current secondary photos", async () => {
    const roomId = "demo-room-andes";
    await uploadRoomImages(roomId, [file("x"), file("y")], "admin-1");

    await expect(
      reorderRoomImages(roomId, ["not-a-real-photo-id"], "admin-1")
    ).rejects.toThrow(RoomImageInputError);
  });

  it("promotes the next photo when the primary is removed, and audits the removal", async () => {
    const roomId = "demo-room-terra";
    const before = await listRoomImages(roomId);
    for (const photo of before) await removeRoomImage(roomId, photo.id, "admin-1");

    const [first, second] = await uploadRoomImages(
      roomId,
      [file("one-more"), file("two-more")],
      "admin-1"
    );

    await removeRoomImage(roomId, first!.id, "admin-2");

    const after = await listRoomImages(roomId);
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ id: second!.id, isPrimary: true, position: 0 });

    const events = getRoomImageAuditEvents().filter(
      (event) => event.roomId === roomId && event.action === "removed"
    );
    expect(events.some((event) => event.imageId === first!.id)).toBe(true);
  });
});
