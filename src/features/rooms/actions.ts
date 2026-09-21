"use server";
import { revalidatePath } from "next/cache";
import { requireAdministrator } from "@/infrastructure/auth/authorization";
import { createProductionDatabase } from "@/infrastructure/database/client";
import { createDrizzleRoomCreationRepository } from "@/infrastructure/database/room-creation-repository";
import { createDatabaseBoundary } from "@/infrastructure/database/server";
import { listRoomImages } from "@/features/room-images";
import {
  type AmenityRecord,
  getCanonicalMockRoomCreationRepository,
  normalizeAmenityName,
  normalizeRoomDraftInput,
  resolveRoomActivationGaps,
  RoomCreationInputError,
  type RoomCreationRepository,
} from "./room-creation-admin";

export type RoomCreationActionResult =
  | Readonly<{ ok: true; roomId: string }>
  | Readonly<{ ok: false; message: string }>;

export type AmenityActionResult =
  | Readonly<{ ok: true; amenities: readonly AmenityRecord[] }>
  | Readonly<{ ok: false; message: string }>;

export type RoomActivationActionResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; message: string }>;

function repository(): RoomCreationRepository {
  const boundary = createDatabaseBoundary();
  return boundary.context === "mock"
    ? getCanonicalMockRoomCreationRepository()
    : createDrizzleRoomCreationRepository(createProductionDatabase(boundary));
}

function failureMessage(error: unknown, fallback: string) {
  return error instanceof RoomCreationInputError ? error.message : fallback;
}

function revalidate(roomId?: string) {
  revalidatePath("/admin/habitaciones");
  revalidatePath("/habitaciones");
  if (roomId) revalidatePath(`/admin/habitaciones/${roomId}/fotos`);
}

function amenityIdsFrom(data: FormData) {
  return data.getAll("amenityIds").map(String).filter(Boolean);
}

export async function listAmenitiesAction(): Promise<AmenityActionResult> {
  await requireAdministrator();
  try {
    return { ok: true, amenities: await repository().listAmenities() };
  } catch (error) {
    return {
      ok: false,
      message: failureMessage(error, "No pudimos cargar las amenidades."),
    };
  }
}

export async function createAmenityAction(
  data: FormData
): Promise<AmenityActionResult> {
  const user = await requireAdministrator();
  try {
    const name = normalizeAmenityName(data.get("name"));
    await repository().createAmenity(name, user.user.id);
    return { ok: true, amenities: await repository().listAmenities() };
  } catch (error) {
    return {
      ok: false,
      message: failureMessage(error, "No pudimos crear la amenidad."),
    };
  }
}

export async function createRoomDraftAction(
  data: FormData
): Promise<RoomCreationActionResult> {
  const user = await requireAdministrator();
  try {
    const input = normalizeRoomDraftInput({
      amenityIds: amenityIdsFrom(data),
      baseNightlyPriceClp: data.get("baseNightlyPriceClp"),
      bathroomDescription: data.get("bathroomDescription"),
      bedConfiguration: data.get("bedConfiguration"),
      bedCount: data.get("bedCount"),
      capacity: data.get("capacity"),
      description: data.get("description"),
      name: data.get("name"),
      slug: data.get("slug"),
    });
    const { roomId } = await repository().createDraft(input, user.user.id);
    revalidate(roomId);
    return { ok: true, roomId };
  } catch (error) {
    return {
      ok: false,
      message: failureMessage(error, "No pudimos crear la habitación."),
    };
  }
}

export async function activateRoomAction(
  data: FormData
): Promise<RoomActivationActionResult> {
  const user = await requireAdministrator();
  const roomId = String(data.get("roomId") ?? "");
  try {
    const repo = repository();
    const room = await repo.getById(roomId);
    if (!room) {
      throw new RoomCreationInputError("Habitación no encontrada.");
    }
    const photos = await listRoomImages(roomId);
    const gaps = resolveRoomActivationGaps({
      amenitiesCount: room.amenities.length,
      bathroom: room.bathroom,
      bedConfiguration: room.bedConfiguration,
      bedCount: room.bedCount,
      capacity: room.capacity,
      description: room.description,
      imagesCount: photos.length,
      name: room.name,
      nightlyPriceClp: room.nightlyPriceClp,
      slug: room.slug,
    });
    if (gaps.length) {
      throw new RoomCreationInputError(`Falta completar: ${gaps.join(", ")}.`);
    }
    await repo.activate(roomId, user.user.id);
    revalidate(roomId);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: failureMessage(error, "No pudimos activar la habitación."),
    };
  }
}
