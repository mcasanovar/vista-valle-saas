import { resolveRoomNightlyPrice } from "./occupancy-pricing";
import type { RoomReadModel } from "./read-model";

export class RoomPricingInputError extends Error {
  readonly code = "INVALID_ROOM_PRICING_INPUT" as const;
}

export type RoomPricingRecord = Readonly<{
  roomId: string;
  name: string;
  capacity: number;
  /** One price per occupancy tier, `prices[0]` = 1 guest through `prices[capacity - 1]` = full capacity. */
  prices: readonly number[];
}>;

export type RoomPricingUpdateInput = Readonly<{
  prices: readonly number[];
}>;

/** Validates an admin-submitted tariff update: exactly one positive-integer price per occupancy tier, from 1 guest through the room's capacity (see `admin-room-pricing` spec). */
export function normalizeRoomPricingInput(
  candidate: unknown,
  capacity: number
): RoomPricingUpdateInput {
  if (!candidate || typeof candidate !== "object") {
    throw new RoomPricingInputError("Datos de tarifa inválidos.");
  }
  const value = candidate as Record<string, unknown>;
  const rawPrices = value.prices;
  if (!Array.isArray(rawPrices) || rawPrices.length !== capacity) {
    throw new RoomPricingInputError(
      `Indica un precio para cada cantidad de huéspedes (1 a ${capacity}).`
    );
  }
  const prices = rawPrices.map((rawPrice, index) => {
    const price = Number(rawPrice);
    if (!Number.isSafeInteger(price) || price <= 0) {
      throw new RoomPricingInputError(
        `Indica un precio válido para ${index + 1} ${index === 0 ? "persona" : "personas"}.`
      );
    }
    return price;
  });
  return Object.freeze({ prices: Object.freeze(prices) });
}

/** Resolves a room's current tariff record for the admin editor, from whatever occupancy prices it has today. */
export function resolveRoomPricingRecord(room: RoomReadModel): RoomPricingRecord {
  return Object.freeze({
    roomId: room.id,
    name: room.name,
    capacity: room.capacity,
    prices: Object.freeze(
      Array.from({ length: room.capacity }, (_, index) =>
        resolveRoomNightlyPrice(room, room.occupancyPrices, index + 1)
      )
    ),
  });
}

/** Layers a mock-context in-memory override (if any) over a resolved record, for GET/PUT round-tripping without a real database. */
export function applyRoomPricingOverride(
  record: RoomPricingRecord,
  override: RoomPricingUpdateInput | undefined
): RoomPricingRecord {
  if (!override) return record;
  return Object.freeze({ ...record, prices: override.prices });
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
  prices: readonly number[];
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
          prices: input.prices,
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
