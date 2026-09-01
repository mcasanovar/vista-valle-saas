export const roomImagesBucket = "room-images";
export const maxRoomImageBytes = 5 * 1024 * 1024;
export const allowedRoomImageMimeTypes = [
  "image/avif",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const roomImagePathPattern =
  /^rooms\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/([A-Za-z0-9][A-Za-z0-9._-]*\.(?:avif|jpe?g|png|webp))$/i;

const extensionForContentType = {
  "image/avif": ["avif"],
  "image/jpeg": ["jpeg", "jpg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
} as const;

export type RoomImageStorageContext = "mock" | "production";

export type RoomImageObject = Readonly<{
  contentType: string;
  path: string;
  size: number;
}>;

export type RoomImageUpload = Readonly<{
  bytes: Uint8Array;
  contentType: (typeof allowedRoomImageMimeTypes)[number];
  path: string;
}>;

export type RoomImageStorage = Readonly<{
  context: RoomImageStorageContext;
  getPublicUrl: (path: string) => string;
  list: (roomId: string) => Promise<readonly RoomImageObject[]>;
  remove: (path: string) => Promise<void>;
  upload: (upload: RoomImageUpload) => Promise<RoomImageObject>;
}>;

export function assertRoomImageRoomId(roomId: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      roomId
    )
  ) {
    throw new Error("Invalid room image room ID");
  }
}

export function assertRoomImagePath(path: string) {
  if (
    path.includes("\0") ||
    path.includes("\\") ||
    !roomImagePathPattern.test(path)
  ) {
    throw new Error("Invalid room image path");
  }
}

export function assertRoomImageUpload(upload: RoomImageUpload) {
  assertRoomImagePath(upload.path);

  if (!allowedRoomImageMimeTypes.includes(upload.contentType)) {
    throw new Error("Invalid room image content type");
  }

  const extension = upload.path.split(".").pop()?.toLowerCase();
  const allowedExtensions = extensionForContentType[
    upload.contentType
  ] as readonly string[];

  if (!extension || !allowedExtensions.includes(extension)) {
    throw new Error("Room image extension must match its content type");
  }

  if (
    upload.bytes.byteLength === 0 ||
    upload.bytes.byteLength > maxRoomImageBytes
  ) {
    throw new Error("Invalid room image size");
  }
}

export function toRoomImageObject(upload: RoomImageUpload): RoomImageObject {
  return Object.freeze({
    contentType: upload.contentType,
    path: upload.path,
    size: upload.bytes.byteLength,
  });
}
