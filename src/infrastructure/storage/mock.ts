import {
  assertRoomImagePath,
  assertRoomImageRoomId,
  assertRoomImageUpload,
  roomImagesBucket,
  toRoomImageObject,
  type RoomImageObject,
  type RoomImageStorage,
} from "@/infrastructure/storage/contracts";

export function createMockRoomImageStorage(): RoomImageStorage {
  const objects = new Map<string, RoomImageObject>();

  return Object.freeze({
    context: "mock" as const,
    getPublicUrl: (path) => {
      assertRoomImagePath(path);
      return `/mock-storage/${roomImagesBucket}/${path}`;
    },
    list: async (roomId) => {
      assertRoomImageRoomId(roomId);
      const prefix = `rooms/${roomId}/`;

      return [...objects.values()]
        .filter((object) => object.path.startsWith(prefix))
        .map((object) => ({ ...object }));
    },
    remove: async (path) => {
      assertRoomImagePath(path);
      objects.delete(path);
    },
    upload: async (upload) => {
      assertRoomImageUpload(upload);
      const object = toRoomImageObject(upload);
      objects.set(object.path, object);
      return { ...object };
    },
  });
}
