import "server-only";
import { getServerEnvironment } from "@/config/server";
import { createProductionDatabase } from "@/infrastructure/database/client";
import { createDrizzleRoomImageRepository } from "@/infrastructure/database/room-image-repository";
import { createDatabaseBoundary } from "@/infrastructure/database/server";
import {
  allowedRoomImageMimeTypes,
  assertRoomImageUpload,
  extensionForContentType,
  type RoomImageUpload,
} from "@/infrastructure/storage/contracts";
import { createRoomImageStorage } from "@/infrastructure/storage/server";
import { getRoomReadSource } from "@/features/rooms";

export type RoomImageRecord = Readonly<{
  altText: string;
  createdAt: Date;
  id: string;
  position: number;
  roomId: string;
  storagePath: string;
}>;

export type RoomImagePhoto = RoomImageRecord &
  Readonly<{ isPrimary: boolean; url: string }>;

export type RoomImageAuditEvent = Readonly<{
  action:
    | "uploaded"
    | "primary_set"
    | "reordered"
    | "removed";
  actor: string;
  at: Date;
  imageId?: string;
  roomId: string;
}>;

export type RoomImageUploadInput = Readonly<{
  altText?: string;
  bytes: Uint8Array;
  contentType: string;
  filename: string;
}>;

export class RoomImageInputError extends Error {
  readonly code = "ROOM_IMAGE_INPUT_INVALID" as const;
}

const recordsKey = Symbol.for("vista-valle.mock.room-images");
const auditKey = Symbol.for("vista-valle.mock.room-image-audit-events");

function store() {
  const s = globalThis as typeof globalThis & {
    [recordsKey]?: Map<string, RoomImageRecord[]>;
  };
  return (s[recordsKey] ??= new Map<string, RoomImageRecord[]>());
}

function audits() {
  const s = globalThis as typeof globalThis & {
    [auditKey]?: RoomImageAuditEvent[];
  };
  return (s[auditKey] ??= [] as RoomImageAuditEvent[]);
}

export function getRoomImageAuditEvents() {
  return getServerEnvironment().VISTA_VALLE_CONFIG_CONTEXT === "mock"
    ? Object.freeze([...audits()])
    : [];
}

function byPosition(a: RoomImageRecord, b: RoomImageRecord) {
  return a.position - b.position;
}

async function assertRoomExists(roomId: string) {
  const source = await getRoomReadSource();
  if (!source.listActive().some((room) => room.id === roomId))
    throw new RoomImageInputError("Selecciona una habitación válida.");
}

function extensionFor(contentType: string) {
  const extensions = (
    extensionForContentType as Record<string, readonly string[]>
  )[contentType];
  return extensions?.[0];
}

/** Validates every file before touching storage or the database, so a batch upload is all-or-nothing. */
function buildUploads(
  roomId: string,
  files: readonly RoomImageUploadInput[]
): readonly Readonly<{ altText: string; upload: RoomImageUpload }>[] {
  if (!files.length)
    throw new RoomImageInputError("Selecciona al menos una imagen.");

  return files.map((file) => {
    if (
      !allowedRoomImageMimeTypes.includes(
        file.contentType as (typeof allowedRoomImageMimeTypes)[number]
      )
    )
      throw new RoomImageInputError(
        `El archivo "${file.filename}" debe ser AVIF, JPEG, PNG o WEBP.`
      );

    const extension = extensionFor(file.contentType);
    if (!extension)
      throw new RoomImageInputError(
        `El archivo "${file.filename}" tiene un tipo no soportado.`
      );

    const upload: RoomImageUpload = {
      bytes: file.bytes,
      contentType: file.contentType as (typeof allowedRoomImageMimeTypes)[number],
      path: `rooms/${roomId}/${crypto.randomUUID()}.${extension}`,
    };

    try {
      assertRoomImageUpload(upload);
    } catch {
      throw new RoomImageInputError(
        `El archivo "${file.filename}" no es una imagen válida o excede el tamaño permitido.`
      );
    }

    return Object.freeze({ altText: file.altText?.trim() ?? "", upload });
  });
}

function toPhoto(record: RoomImageRecord, url: string): RoomImagePhoto {
  return Object.freeze({ ...record, isPrimary: record.position === 0, url });
}

export async function listRoomImages(
  roomId: string
): Promise<readonly RoomImagePhoto[]> {
  const storage = createRoomImageStorage();
  const boundary = createDatabaseBoundary();

  const records =
    boundary.context === "mock"
      ? Object.freeze([...(store().get(roomId) ?? [])].sort(byPosition))
      : await createDrizzleRoomImageRepository(
          createProductionDatabase(boundary)
        ).listByRoom(roomId);

  return Object.freeze(
    records.map((record) => toPhoto(record, storage.getPublicUrl(record.storagePath)))
  );
}

export async function uploadRoomImages(
  roomId: string,
  files: readonly RoomImageUploadInput[],
  actor: string
): Promise<readonly RoomImagePhoto[]> {
  await assertRoomExists(roomId);
  const uploads = buildUploads(roomId, files);
  const storage = createRoomImageStorage();
  const uploaded: string[] = [];

  try {
    for (const { upload } of uploads) {
      await storage.upload(upload);
      uploaded.push(upload.path);
    }
  } catch (error) {
    await Promise.allSettled(uploaded.map((path) => storage.remove(path)));
    throw error;
  }

  const boundary = createDatabaseBoundary();

  try {
    if (boundary.context === "mock") {
      const at = new Date();
      const list = store().get(roomId) ?? [];
      const nextPosition = list.length
        ? Math.max(...list.map((record) => record.position)) + 1
        : 0;
      const created = uploads.map(({ altText, upload }, index) =>
        Object.freeze({
          altText,
          createdAt: at,
          id: crypto.randomUUID(),
          position: nextPosition + index,
          roomId,
          storagePath: upload.path,
        })
      );
      store().set(roomId, [...list, ...created]);
      for (const image of created)
        audits().push(
          Object.freeze({ action: "uploaded", actor, at, imageId: image.id, roomId })
        );
      return Object.freeze(
        created.map((record) => toPhoto(record, storage.getPublicUrl(record.storagePath)))
      );
    }

    const db = createProductionDatabase(boundary);
    const repository = createDrizzleRoomImageRepository(db);
    const created = await db.transaction((tx) =>
      repository.appendMany(
        tx,
        roomId,
        uploads.map(({ altText, upload }) => ({
          altText,
          storagePath: upload.path,
        })),
        actor
      )
    );
    return Object.freeze(
      created.map((record) => toPhoto(record, storage.getPublicUrl(record.storagePath)))
    );
  } catch (error) {
    await Promise.allSettled(uploaded.map((path) => storage.remove(path)));
    throw error;
  }
}

async function currentOrder(roomId: string): Promise<readonly RoomImageRecord[]> {
  const boundary = createDatabaseBoundary();
  return boundary.context === "mock"
    ? Object.freeze([...(store().get(roomId) ?? [])].sort(byPosition))
    : createDrizzleRoomImageRepository(
        createProductionDatabase(boundary)
      ).listByRoom(roomId);
}

async function persistOrder(
  roomId: string,
  orderedImageIds: readonly string[],
  actor: string,
  action: "primary_set" | "reordered" | "removed"
): Promise<void> {
  const boundary = createDatabaseBoundary();

  if (boundary.context === "mock") {
    const list = store().get(roomId) ?? [];
    const byId = new Map(list.map((record) => [record.id, record]));
    const reordered = orderedImageIds.map((id, position) => {
      const record = byId.get(id);
      if (!record) throw new RoomImageInputError("Foto no encontrada.");
      return Object.freeze({ ...record, position });
    });
    store().set(roomId, reordered);
    audits().push(
      Object.freeze({ action, actor, at: new Date(), roomId })
    );
    return;
  }

  const db = createProductionDatabase(boundary);
  await db.transaction((tx) =>
    createDrizzleRoomImageRepository(db).persistOrder(
      tx,
      roomId,
      orderedImageIds,
      actor,
      `room_image.${action}`
    )
  );
}

export async function setPrimaryRoomImage(
  roomId: string,
  imageId: string,
  actor: string
): Promise<void> {
  const list = await currentOrder(roomId);
  if (!list.some((record) => record.id === imageId))
    throw new RoomImageInputError("Foto no encontrada.");
  if (list[0]?.id === imageId) return;

  const order = [imageId, ...list.filter((record) => record.id !== imageId).map((record) => record.id)];
  await persistOrder(roomId, order, actor, "primary_set");
}

export async function reorderRoomImages(
  roomId: string,
  secondaryOrderedIds: readonly string[],
  actor: string
): Promise<void> {
  const list = await currentOrder(roomId);
  if (!list.length)
    throw new RoomImageInputError("La habitación no tiene fotos.");

  const [primary, ...secondary] = list;
  const currentSecondaryIds = new Set(secondary.map((record) => record.id));
  const providedIds = new Set(secondaryOrderedIds);
  if (
    currentSecondaryIds.size !== providedIds.size ||
    [...currentSecondaryIds].some((id) => !providedIds.has(id))
  )
    throw new RoomImageInputError(
      "El nuevo orden debe incluir exactamente las fotos secundarias actuales."
    );

  await persistOrder(roomId, [primary!.id, ...secondaryOrderedIds], actor, "reordered");
}

export async function removeRoomImage(
  roomId: string,
  imageId: string,
  actor: string
): Promise<void> {
  const list = await currentOrder(roomId);
  const target = list.find((record) => record.id === imageId);
  if (!target) throw new RoomImageInputError("Foto no encontrada.");

  const storage = createRoomImageStorage();
  await storage.remove(target.storagePath);

  const boundary = createDatabaseBoundary();
  const remaining = list.filter((record) => record.id !== imageId).map((record) => record.id);

  if (boundary.context === "mock") {
    store().set(roomId, list.filter((record) => record.id !== imageId));
    audits().push(
      Object.freeze({ action: "removed", actor, at: new Date(), imageId, roomId })
    );
  } else {
    const db = createProductionDatabase(boundary);
    await db.transaction((tx) =>
      createDrizzleRoomImageRepository(db).remove(tx, roomId, imageId, actor)
    );
  }

  if (remaining.length) await persistOrder(roomId, remaining, actor, "reordered");
}
