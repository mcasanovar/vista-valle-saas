import "server-only";

import { v2 as cloudinary, type ResourceApiResponse } from "cloudinary";

import { getServerEnvironment } from "@/config/server";
import {
  assertRoomImagePath,
  assertRoomImageRoomId,
  assertRoomImageUpload,
  roomImagesFolder,
  toRoomImageObject,
  type RoomImageObject,
  type RoomImageStorage,
} from "@/infrastructure/storage/contracts";
import { createMockRoomImageStorage } from "@/infrastructure/storage/mock";

const contentTypeByFormat: Record<string, string> = {
  avif: "image/avif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function storageFailure() {
  return new Error("Unable to complete the room image storage operation");
}

/** Cloudinary's own extension suffix is derived from the uploaded content, so the DB-facing `path` (which already carries an extension) maps to a public ID without one. */
function toPublicId(path: string) {
  return `${roomImagesFolder}/${path.replace(/\.[^./]+$/, "")}`;
}

export type CloudinaryCredentials = Readonly<{
  apiKey: string;
  apiSecret: string;
  cloudName: string;
}>;

/** Isolated from `getServerEnvironment()` so the Cloudinary-backed adapter can be exercised in tests without flipping `VISTA_VALLE_CONFIG_CONTEXT`; `createRoomImageStorage()` is the env-driven entry point every caller outside tests should use. */
export function createCloudinaryRoomImageStorage(
  credentials: CloudinaryCredentials
): RoomImageStorage {
  cloudinary.config({
    api_key: credentials.apiKey,
    api_secret: credentials.apiSecret,
    cloud_name: credentials.cloudName,
    secure: true,
  });

  return Object.freeze({
    context: "production" as const,
    getPublicUrl: (path) => {
      assertRoomImagePath(path);
      return cloudinary.url(toPublicId(path), { secure: true });
    },
    list: async (roomId) => {
      assertRoomImageRoomId(roomId);
      const prefix = `${roomImagesFolder}/rooms/${roomId}/`;

      try {
        const { resources } = (await cloudinary.api.resources({
          max_results: 500,
          prefix,
          type: "upload",
        })) as ResourceApiResponse;

        return resources.map<RoomImageObject>((resource) => ({
          contentType:
            contentTypeByFormat[resource.format] ?? "application/octet-stream",
          path: `rooms/${roomId}/${resource.public_id.slice(prefix.length)}.${resource.format}`,
          size: resource.bytes,
        }));
      } catch {
        throw storageFailure();
      }
    },
    remove: async (path) => {
      assertRoomImagePath(path);

      try {
        await cloudinary.uploader.destroy(toPublicId(path), {
          resource_type: "image",
        });
      } catch {
        throw storageFailure();
      }
    },
    upload: async (upload) => {
      assertRoomImageUpload(upload);

      try {
        await cloudinary.uploader.upload(
          `data:${upload.contentType};base64,${Buffer.from(upload.bytes).toString("base64")}`,
          {
            overwrite: true,
            public_id: toPublicId(upload.path),
            resource_type: "image",
          }
        );
      } catch {
        throw storageFailure();
      }

      return toRoomImageObject(upload);
    },
  });
}

export function createRoomImageStorage(): RoomImageStorage {
  const server = getServerEnvironment();

  if (server.VISTA_VALLE_CONFIG_CONTEXT === "mock") {
    return createMockRoomImageStorage();
  }

  return createCloudinaryRoomImageStorage({
    apiKey: server.CLOUDINARY_API_KEY,
    apiSecret: server.CLOUDINARY_API_SECRET,
    cloudName: server.CLOUDINARY_CLOUD_NAME,
  });
}
