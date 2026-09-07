"use server";
import { revalidatePath } from "next/cache";
import { requireAdministrator } from "@/infrastructure/auth/authorization";
import {
  listRoomImages,
  removeRoomImage,
  reorderRoomImages,
  RoomImageInputError,
  setPrimaryRoomImage,
  uploadRoomImages,
  type RoomImagePhoto,
} from "./room-images";

export type RoomImageActionResult =
  | Readonly<{ ok: true; photos: readonly RoomImagePhoto[] }>
  | Readonly<{ ok: false; message: string }>;

function revalidate(roomId: string) {
  revalidatePath(`/admin/habitaciones/${roomId}/fotos`);
  revalidatePath("/habitaciones");
}

function failureMessage(error: unknown, fallback: string) {
  return error instanceof RoomImageInputError ? error.message : fallback;
}

export async function listRoomImagesAction(
  roomId: string
): Promise<RoomImageActionResult> {
  await requireAdministrator();
  try {
    return { ok: true, photos: await listRoomImages(roomId) };
  } catch (error) {
    return {
      ok: false,
      message: failureMessage(error, "No pudimos cargar las fotos."),
    };
  }
}

export async function uploadRoomImagesAction(
  data: FormData
): Promise<RoomImageActionResult> {
  const user = await requireAdministrator();
  const roomId = String(data.get("roomId") ?? "");
  const files = data
    .getAll("files")
    .filter(
      (value): value is File =>
        typeof value === "object" &&
        value !== null &&
        typeof (value as File).arrayBuffer === "function"
    );
  const altTexts = data.getAll("altTexts").map(String);

  try {
    const inputs = await Promise.all(
      files.map(async (file, index) => ({
        altText: altTexts[index] ?? "",
        bytes: new Uint8Array(await file.arrayBuffer()),
        contentType: file.type,
        filename: file.name,
      }))
    );
    await uploadRoomImages(roomId, inputs, user.user.id);
    revalidate(roomId);
    return { ok: true, photos: await listRoomImages(roomId) };
  } catch (error) {
    return {
      ok: false,
      message: failureMessage(error, "No pudimos subir las fotos."),
    };
  }
}

export async function setPrimaryRoomImageAction(
  data: FormData
): Promise<RoomImageActionResult> {
  const user = await requireAdministrator();
  const roomId = String(data.get("roomId") ?? "");
  try {
    await setPrimaryRoomImage(roomId, String(data.get("imageId") ?? ""), user.user.id);
    revalidate(roomId);
    return { ok: true, photos: await listRoomImages(roomId) };
  } catch (error) {
    return {
      ok: false,
      message: failureMessage(error, "No pudimos cambiar la foto principal."),
    };
  }
}

export async function reorderRoomImagesAction(
  data: FormData
): Promise<RoomImageActionResult> {
  const user = await requireAdministrator();
  const roomId = String(data.get("roomId") ?? "");
  try {
    await reorderRoomImages(
      roomId,
      data.getAll("secondaryImageIds").map(String),
      user.user.id
    );
    revalidate(roomId);
    return { ok: true, photos: await listRoomImages(roomId) };
  } catch (error) {
    return {
      ok: false,
      message: failureMessage(error, "No pudimos reordenar las fotos."),
    };
  }
}

export async function removeRoomImageAction(
  data: FormData
): Promise<RoomImageActionResult> {
  const user = await requireAdministrator();
  const roomId = String(data.get("roomId") ?? "");
  try {
    await removeRoomImage(roomId, String(data.get("imageId") ?? ""), user.user.id);
    revalidate(roomId);
    return { ok: true, photos: await listRoomImages(roomId) };
  } catch (error) {
    return {
      ok: false,
      message: failureMessage(error, "No pudimos eliminar la foto."),
    };
  }
}
