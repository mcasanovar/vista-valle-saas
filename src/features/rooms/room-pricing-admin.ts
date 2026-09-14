import { resolveRoomNightlyPrice } from "./occupancy-pricing";
import type { RoomReadModel } from "./read-model";

export class RoomPricingInputError extends Error {
  readonly code = "INVALID_ROOM_PRICING_INPUT" as const;
}

export type RoomPricingRecord = Readonly<{
  roomId: string;
  name: string;
  capacity: number;
  priceOneGuestClp: number;
  /** Equal to `priceOneGuestClp` for a capacity-1 room, which has no second occupancy tier. */
  priceTwoGuestsClp: number;
}>;

export type RoomPricingUpdateInput = Readonly<{
  priceOneGuestClp: number;
  priceTwoGuestsClp: number;
}>;

/** Validates an admin-submitted tariff update (see `admin-room-pricing` spec). */
export function normalizeRoomPricingInput(
  candidate: unknown
): RoomPricingUpdateInput {
  if (!candidate || typeof candidate !== "object") {
    throw new RoomPricingInputError("Datos de tarifa inválidos.");
  }
  const value = candidate as Record<string, unknown>;
  const priceOneGuestClp = Number(value.priceOneGuestClp);
  const priceTwoGuestsClp = Number(value.priceTwoGuestsClp);
  if (!Number.isSafeInteger(priceOneGuestClp) || priceOneGuestClp <= 0) {
    throw new RoomPricingInputError(
      "Indica un precio válido para 1 persona."
    );
  }
  if (!Number.isSafeInteger(priceTwoGuestsClp) || priceTwoGuestsClp <= 0) {
    throw new RoomPricingInputError(
      "Indica un precio válido para 2 personas."
    );
  }
  return Object.freeze({ priceOneGuestClp, priceTwoGuestsClp });
}

/** Resolves a room's current tariff record for the admin editor, from whatever occupancy prices it has today. */
export function resolveRoomPricingRecord(room: RoomReadModel): RoomPricingRecord {
  return Object.freeze({
    roomId: room.id,
    name: room.name,
    capacity: room.capacity,
    priceOneGuestClp: resolveRoomNightlyPrice(room, room.occupancyPrices, 1),
    priceTwoGuestsClp:
      room.capacity > 1
        ? resolveRoomNightlyPrice(room, room.occupancyPrices, 2)
        : resolveRoomNightlyPrice(room, room.occupancyPrices, 1),
  });
}

/** Layers a mock-context in-memory override (if any) over a resolved record, for GET/PUT round-tripping without a real database. */
export function applyRoomPricingOverride(
  record: RoomPricingRecord,
  override: RoomPricingUpdateInput | undefined
): RoomPricingRecord {
  if (!override) return record;
  return Object.freeze({
    ...record,
    priceOneGuestClp: override.priceOneGuestClp,
    priceTwoGuestsClp:
      record.capacity > 1 ? override.priceTwoGuestsClp : override.priceOneGuestClp,
  });
}

export type RoomPricingRepository = Readonly<{
  update: (
    room: Pick<RoomReadModel, "capacity" | "id">,
    input: RoomPricingUpdateInput,
    actorUserId: string
  ) => Promise<void>;
}>;

export type RoomPricingAuditEvent = Readonly<{
  actorUserId: string;
  occurredAt: Date;
  priceOneGuestClp: number;
  priceTwoGuestsClp: number | null;
  roomId: string;
}>;

/** In-memory double used only under `VISTA_VALLE_CONFIG_CONTEXT=mock`. */
export function createMockRoomPricingRepository(): RoomPricingRepository & {
  overrideFor: (roomId: string) => RoomPricingUpdateInput | undefined;
  audits: () => readonly RoomPricingAuditEvent[];
} {
  const overrides = new Map<string, RoomPricingUpdateInput>();
  const audits: RoomPricingAuditEvent[] = [];
  return Object.freeze({
    audits: () => Object.freeze([...audits]),
    overrideFor: (roomId: string) => overrides.get(roomId),
    update: async (room, input, actorUserId) => {
      overrides.set(room.id, input);
      audits.push(
        Object.freeze({
          actorUserId,
          occurredAt: new Date(),
          priceOneGuestClp: input.priceOneGuestClp,
          priceTwoGuestsClp: room.capacity > 1 ? input.priceTwoGuestsClp : null,
          roomId: room.id,
        })
      );
    },
  });
}

const canonicalMockRoomPricingRepositoryKey = Symbol.for(
  "vista-valle.mock.room-pricing-repository"
);

export function getCanonicalMockRoomPricingRepository() {
  const scope = globalThis as typeof globalThis & {
    [canonicalMockRoomPricingRepositoryKey]?: ReturnType<
      typeof createMockRoomPricingRepository
    >;
  };
  return (scope[canonicalMockRoomPricingRepositoryKey] ??=
    createMockRoomPricingRepository());
}
