import type { GuestContactDetails, GuestContactEditInput } from "./guest";

/**
 * A persisted `guests` row (see `src/persistence/schema.ts`). Mirrors
 * `GuestContactDetails` plus the generated `id`.
 */
export type GuestRecord = Readonly<
  GuestContactDetails & {
    id: string;
  }
>;

/**
 * Persistence contract for creating a guest. `TContext` is threaded
 * through from whatever `RoomLockGateway<TContext>` the caller is using
 * (see `@/features/availability`'s `room-lock.ts`): the mock room-lock
 * gateway hands operations a `MockRoomLockOperationContext`, and the
 * Drizzle-backed gateway (`src/infrastructure/database/room-lock.ts`)
 * hands operations the open `ProductionRoomLockTransaction`. Sharing the
 * exact same `TContext` type parameter lets `createPaymentHold`
 * (`./create-hold.ts`) pass the context it receives from
 * `RoomLockGateway.runExclusive` straight into `createGuest` without any
 * adapter needing to know about the other adapter's internals: the mock
 * repository never touches the context, and the Drizzle repository runs
 * its `INSERT` against the same open transaction the room lock holds, so
 * guest creation, hold creation, and the room lock commit or roll back
 * together.
 */
export class GuestNotFoundError extends Error {
  readonly code = "GUEST_NOT_FOUND" as const;
  readonly guestId: string;

  constructor(guestId: string) {
    super(`Guest ${guestId} not found`);
    this.name = "GuestNotFoundError";
    this.guestId = guestId;
  }
}

export type GuestRepository<TContext> = Readonly<{
  createGuest: (
    context: TContext,
    guest: GuestContactDetails
  ) => Promise<GuestRecord>;
  /**
   * Non-transactional read, used later once a guest already exists (e.g.
   * resolving the email address for a confirmation notification from a
   * hold's `guestId` — see `confirm-pay-now-reservation.ts`), matching
   * `HoldRepository.getHoldById`'s read semantics.
   */
  getGuestById: (id: string) => Promise<GuestRecord | null>;
  /**
   * Mock persistence has no database transaction to unwind. Implementations
   * that need compensation may expose this hook; production relies on the
   * surrounding room-lock transaction instead.
   */
  rollbackGuest?: (context: TContext, guest: GuestRecord) => Promise<void>;
  /**
   * Non-transactional contact-info update, used by
   * `editReservationGuestContact` (design.md decision 4 of
   * "allow-full-reservation-editing-and-ota-sync-toggle"): unlike
   * `createGuest`, this edit has no other side effect to stay atomic with,
   * so it never needs a room-lock transaction. Throws `GuestNotFoundError`
   * when `id` does not match a persisted guest.
   */
  updateGuest: (
    id: string,
    contact: GuestContactEditInput
  ) => Promise<GuestRecord>;
}>;

export type MockGuestRepository<TContext> = GuestRepository<TContext>;

type MockGuestStorage = Readonly<{ guestsById: Map<string, GuestRecord> }>;

const canonicalGuestStorageKey = Symbol.for(
  "vista-valle.mock.canonical-guest-storage"
);

function createGuestStorage(): MockGuestStorage {
  return { guestsById: new Map<string, GuestRecord>() };
}

function getCanonicalGuestStorage(): MockGuestStorage {
  const scope = globalThis as typeof globalThis & {
    [canonicalGuestStorageKey]?: MockGuestStorage;
  };
  return (scope[canonicalGuestStorageKey] ??= createGuestStorage());
}

/**
 * Deterministic, in-memory `GuestRepository` for tests and mock
 * infrastructure (see design.md decision 13). `context` is accepted for
 * contract symmetry with the Drizzle-backed implementation but ignored:
 * the mock has no transaction to run inside.
 */
export function createMockGuestRepository<TContext>(
  storage: MockGuestStorage = createGuestStorage()
): MockGuestRepository<TContext> {
  return Object.freeze({
    createGuest: (_context: TContext, guest: GuestContactDetails) => {
      const record = Object.freeze({ ...guest, id: crypto.randomUUID() });
      storage.guestsById.set(record.id, record);
      return Promise.resolve(record);
    },
    getGuestById: (id) => Promise.resolve(storage.guestsById.get(id) ?? null),
    rollbackGuest: (_context, guest) => {
      storage.guestsById.delete(guest.id);
      return Promise.resolve();
    },
    updateGuest: (id, contact) => {
      const existing = storage.guestsById.get(id);
      if (!existing) return Promise.reject(new GuestNotFoundError(id));
      const updated = Object.freeze({ ...existing, ...contact });
      storage.guestsById.set(id, updated);
      return Promise.resolve(updated);
    },
  });
}

/** Shared only by the explicit mock composition across Route Handler/page bundles. */
export function createCanonicalMockGuestRepository<TContext>() {
  return createMockGuestRepository<TContext>(getCanonicalGuestStorage());
}
