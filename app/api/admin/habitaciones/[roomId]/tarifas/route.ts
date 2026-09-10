import {
  applyRoomPricingOverride,
  getCanonicalMockRoomPricingRepository,
  getRoomReadSource,
  normalizeRoomPricingInput,
  resolveRoomPricingRecord,
  RoomPricingInputError,
} from "@/features/rooms";
import { requireAdministrator } from "@/infrastructure/auth/authorization";
import { createProductionDatabase } from "@/infrastructure/database/client";
import { createDrizzleRoomPricingRepository } from "@/infrastructure/database/room-pricing-repository";
import { createDatabaseBoundary } from "@/infrastructure/database/server";

export const dynamic = "force-dynamic";

async function findRoom(roomId: string) {
  const source = await getRoomReadSource();
  return source.listActive().find((room) => room.id === roomId) ?? null;
}

function getRepository() {
  const boundary = createDatabaseBoundary();
  if (boundary.context !== "production") {
    return { mock: true, repository: getCanonicalMockRoomPricingRepository() } as const;
  }
  return {
    mock: false,
    repository: createDrizzleRoomPricingRepository(
      createProductionDatabase(boundary)
    ),
  } as const;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    await requireAdministrator();
  } catch {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { roomId } = await params;
  const room = await findRoom(roomId);
  if (!room) {
    return Response.json({ error: "Habitación no encontrada" }, { status: 404 });
  }

  const record = resolveRoomPricingRecord(room);
  const { mock, repository } = getRepository();
  const resolved = mock
    ? applyRoomPricingOverride(
        record,
        (repository as ReturnType<typeof getCanonicalMockRoomPricingRepository>).overrideFor(
          room.id
        )
      )
    : record;
  return Response.json(resolved);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    await requireAdministrator();
  } catch {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { roomId } = await params;
  const room = await findRoom(roomId);
  if (!room) {
    return Response.json({ error: "Habitación no encontrada" }, { status: 404 });
  }

  try {
    const user = await requireAdministrator();
    const input = normalizeRoomPricingInput(await request.json());
    const { repository } = getRepository();
    await repository.update(room, input, user.user.id);
    return Response.json({
      roomId: room.id,
      name: room.name,
      capacity: room.capacity,
      priceOneGuestClp: input.priceOneGuestClp,
      priceTwoGuestsClp:
        room.capacity > 1 ? input.priceTwoGuestsClp : input.priceOneGuestClp,
    });
  } catch (error) {
    if (error instanceof RoomPricingInputError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json(
      { error: "No pudimos actualizar la tarifa." },
      { status: 500 }
    );
  }
}
