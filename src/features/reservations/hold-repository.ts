import {
  createLodgingInterval,
  type MockRoomLockOperationContext,
} from "@/features/availability";

import type { ReservationItemPricingResult } from "./pricing";

/** One room's frozen line within a hold (mirrors `ReservationItemRecord`). */
export type ReservationHoldItemRecord = Readonly<{
  chargesClp: number;
  guestCount: number;
  nightlyPriceClp: number;
  nights: number;
  roomId: string;
  subtotalClp: number;
}>;

/**
 * A persisted `reservation_holds` row plus its `reservation_hold_items`
 * (see `src/persistence/schema.ts`). Unlike `reservations`, holds have no
 * `publicId`: they are an internal, temporary entity never shown to the
 * guest as a booking confirmation (design.md decision 8). A hold always
 * covers every room of the reservation being paid for with a single
 * payment — there is no per-room hold or partial release.
 */
export type ReservationHoldRecord = Readonly<{
  checkIn: string;
  checkOut: string;
  createdAt: Date;
  expiresAt: Date;
  guestId: string;
  id: string;
  items: readonly ReservationHoldItemRecord[];
  totalClp: number;
}>;

/**
 * Input required to persist a hold. `items` is always the frozen
 * `ReservationItemPricingResult[]` produced by `computeMultiRoomReservationPricing`
 * (`./pricing.ts`) so a repository implementation never has to (and never
 * gets the chance to) recompute or accept a caller-supplied total.
 */
export type CreateHoldInput = Readonly<{
  checkIn: string;
  checkOut: string;
  expiresAt: Date;
  guestId: string;
  items: readonly ReservationItemPricingResult[];
  totalClp: number;
}>;

/**
 * Persistence contract for holds. `createHold` threads the same
 * `TContext` type parameter as `RoomLockGateway<TContext>` and
 * `GuestRepository<TContext>` (see `./guest-repository.ts`) so it can run
 * atomically with the room lock and the guest insert. `getHoldById` does
 * not take a context: it is a plain, non-transactional read used later
 * (e.g. Checkout Pro preference creation) once a hold already exists.
 */
export type HoldRepository<TContext> = Readonly<{
  createHold: (
    context: TContext,
    input: CreateHoldInput
  ) => Promise<ReservationHoldRecord>;
  getHoldById: (id: string) => Promise<ReservationHoldRecord | null>;
  /**
   * Removes a hold once it has been consumed (converted into a reservation)
   * or definitively failed (its payment was rejected/cancelled), freeing the
   * room immediately instead of waiting for `expiresAt`. Must run inside the
   * same `RoomLockGateway.runLocked`/`runExclusive` context that is
   * confirming or failing the hold's payment (see
   * `@/features/payments/fintoc-checkout.ts`).
   */
  deleteHold: (
    context: TContext,
    hold: ReservationHoldRecord
  ) => Promise<void>;
}>;

/**
 * Deterministic, in-memory `HoldRepository` for tests and mock
 * infrastructure (see design.md decision 13). Holds are keyed by
 * generated id in a plain `Map`, so `getHoldById` reflects whatever has
 * been created regardless of which mock room-lock context created it.
 *
 * Unlike `createMockGuestRepository`, this factory is fixed to
 * `MockRoomLockOperationContext` rather than generic over `TContext`:
 * a created hold must be registered as an occupying interval so a later
 * `RoomLockGateway.runExclusive` call for an overlapping interval is
 * rejected (design.md decision 6 and the "Vencimiento de retenciones"
 * requirement), and `MockRoomLockOperationContext.recordOccupancy` is the
 * only mechanism the mock room-lock gateway exposes for that. Composing
 * `createPaymentHold` (`./create-hold.ts`) with `createMockRoomLockGateway`
 * naturally aligns every `TContext` type parameter to
 * `MockRoomLockOperationContext`, so this is not a departure from the
 * shared-`TContext` contract described on `HoldRepository`, only a
 * concrete instantiation of it.
 */
export function createMockHoldRepository(): HoldRepository<MockRoomLockOperationContext> {
  const holdsById = new Map<string, ReservationHoldRecord>();

  return Object.freeze({
    createHold: (
      context: MockRoomLockOperationContext,
      input: CreateHoldInput
    ) => {
      if (input.items.length === 0) {
        throw new Error("Hold requires at least one room item");
      }
      const items: ReservationHoldItemRecord[] = input.items.map((item) =>
        Object.freeze({
          chargesClp: item.chargesClp,
          guestCount: item.guestCount,
          nightlyPriceClp: item.nightlyPriceClp,
          nights: item.nights,
          roomId: item.roomId,
          subtotalClp: item.totalClp,
        })
      );
      const record: ReservationHoldRecord = Object.freeze({
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        createdAt: new Date(),
        expiresAt: input.expiresAt,
        guestId: input.guestId,
        id: crypto.randomUUID(),
        items: Object.freeze(items),
        totalClp: input.totalClp,
      });

      holdsById.set(record.id, record);

      for (const item of items) {
        context.recordOccupancy({
          expiresAt: record.expiresAt,
          interval: createLodgingInterval(input.checkIn, input.checkOut),
          roomId: item.roomId,
          source: "hold",
          sourceId: record.id,
        });
      }

      return Promise.resolve(record);
    },
    getHoldById: (id: string) => Promise.resolve(holdsById.get(id) ?? null),
    deleteHold: (context: MockRoomLockOperationContext, hold) => {
      holdsById.delete(hold.id);
      for (const item of hold.items) {
        context.removeOccupancy("hold", hold.id, item.roomId);
      }
      return Promise.resolve();
    },
  });
}

const canonicalMockHoldRepositoryKey = Symbol.for(
  "vista-valle.mock.canonical-hold-repository"
);

/**
 * Shared only by the explicit mock composition across Route Handler/page
 * bundles (mirrors `createCanonicalMockReservationRepository`): the
 * checkout route that creates a hold and the webhook route that later
 * confirms or releases it run as separate requests, so both must see the
 * same in-memory hold storage.
 */
export function getCanonicalMockHoldRepository(): HoldRepository<MockRoomLockOperationContext> {
  const scope = globalThis as typeof globalThis & {
    [canonicalMockHoldRepositoryKey]?: HoldRepository<MockRoomLockOperationContext>;
  };
  return (scope[canonicalMockHoldRepositoryKey] ??= createMockHoldRepository());
}

/**
 * Pure helper for whether a hold has expired as of `now()` (defaulting to
 * real time so it stays deterministic in tests). Used by
 * `@/features/availability`'s occupancy filtering conceptually (see
 * `isUnexpiredHold` in `occupancy-source.ts`) and, going forward, by UI
 * and checkout-return flows (e.g. task 5.5's "expired" state) that need
 * the same expiry rule applied to a single already-fetched hold.
 */
export function isHoldExpired(
  hold: { expiresAt: Date },
  now: () => Date = () => new Date()
): boolean {
  return hold.expiresAt.getTime() <= now().getTime();
}
