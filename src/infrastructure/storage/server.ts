import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getPublicEnvironment } from "@/config/public";
import { getServerEnvironment } from "@/config/server";
import {
  assertRoomImagePath,
  assertRoomImageRoomId,
  assertRoomImageUpload,
  roomImagesBucket,
  toRoomImageObject,
  type RoomImageObject,
  type RoomImageStorage,
} from "@/infrastructure/storage/contracts";
import { createMockRoomImageStorage } from "@/infrastructure/storage/mock";

function storageFailure() {
  return new Error("Unable to complete the room image storage operation");
}

export function createRoomImageStorage(): RoomImageStorage {
  const server = getServerEnvironment();
  const publicEnvironment = getPublicEnvironment();

  if (
    publicEnvironment.NEXT_PUBLIC_VISTA_VALLE_CONFIG_CONTEXT !==
    server.VISTA_VALLE_CONFIG_CONTEXT
  ) {
    throw new Error(
      "Invalid environment configuration: public and server configuration contexts must match"
    );
  }

  if (server.VISTA_VALLE_CONFIG_CONTEXT === "mock") {
    return createMockRoomImageStorage();
  }

  const client = createClient(
    publicEnvironment.NEXT_PUBLIC_SUPABASE_URL,
    server.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  return Object.freeze({
    context: "production" as const,
    getPublicUrl: (path) => {
      assertRoomImagePath(path);
      return client.storage.from(roomImagesBucket).getPublicUrl(path).data
        .publicUrl;
    },
    list: async (roomId) => {
      assertRoomImageRoomId(roomId);
      const { data, error } = await client.storage
        .from(roomImagesBucket)
        .list(`rooms/${roomId}`);

      if (error) {
        throw storageFailure();
      }

      return data.map<RoomImageObject>((object) => ({
        contentType: object.metadata?.mimetype ?? "application/octet-stream",
        path: `rooms/${roomId}/${object.name}`,
        size: Number(object.metadata?.size ?? 0),
      }));
    },
    remove: async (path) => {
      assertRoomImagePath(path);
      const { error } = await client.storage
        .from(roomImagesBucket)
        .remove([path]);

      if (error) {
        throw storageFailure();
      }
    },
    upload: async (upload) => {
      assertRoomImageUpload(upload);
      const { error } = await client.storage
        .from(roomImagesBucket)
        .upload(upload.path, upload.bytes, {
          contentType: upload.contentType,
          upsert: true,
        });

      if (error) {
        throw storageFailure();
      }

      return toRoomImageObject(upload);
    },
  });
}
