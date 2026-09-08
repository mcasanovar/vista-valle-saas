import "server-only";
import { RoomLockConflictError } from "@/features/availability";
import {
  createMultiRoomPayAtPropertyReservation,
  mockGuestRepository,
  mockReservationRepository,
  mockRoomLockGateway,
  transitionReservationState,
  type ReservationRecord,
} from "@/features/reservations";
import { getRoomReadSource } from "@/features/rooms";
import { createProductionDatabase } from "@/infrastructure/database/client";
import { createDrizzleGuestRepository } from "@/infrastructure/database/guest-repository";
import { createDrizzleReservationRepository } from "@/infrastructure/database/reservation-repository";
import { createDrizzleRoomLockGateway } from "@/infrastructure/database/room-lock";
import { createDatabaseBoundary } from "@/infrastructure/database/server";
import { and, eq } from "drizzle-orm";
import { reservationItems, reservations } from "@/persistence/schema";
import { recordChannelSyncConflictAlert } from "./conflict-alerts";
import type { ChannelConnection } from "./connections";
import { createChannelSyncGuestCandidate } from "./guest-placeholder";
import {
  parseInboundIcalEvents,
  type InboundIcalEvent,
} from "./inbound-parser";

export type ChannelSyncIngestResult = Readonly<{
  created: readonly ReservationRecord[];
  skippedExisting: number;
  conflicts: number;
  cancelled: readonly ReservationRecord[];
}>;

async function findExistingByExternalRef(
  platform: ChannelConnection["platform"],
  uid: string
) {
  const boundary = createDatabaseBoundary();
  if (boundary.context === "production") {
    const db = createProductionDatabase(boundary);
    const [row] = await db
      .select({ id: reservations.id })
      .from(reservations)
      .where(
        and(
          eq(reservations.externalPlatform, platform),
          eq(reservations.externalRef, uid)
        )
      );
    if (!row) return undefined;
    return createDrizzleReservationRepository(db).getReservationById(row.id);
  }
  const mockReservations =
    (await mockReservationRepository.listReservations?.()) ?? [];
  return mockReservations.find(
    (r) => r.externalPlatform === platform && r.externalRef === uid
  );
}

async function createReservationFromEvent(
  connection: ChannelConnection,
  event: InboundIcalEvent
): Promise<Readonly<{ created?: ReservationRecord; conflict?: boolean }>> {
  const rooms = await getRoomReadSource();
  const room = rooms.listActive().find((r) => r.id === connection.roomId);
  if (!room) return {};

  const boundary = createDatabaseBoundary();
  const production = boundary.context === "production";
  const db = production ? createProductionDatabase(boundary) : null;
  const reservationRepository = production
    ? createDrizzleReservationRepository(db!)
    : mockReservationRepository;
  const guestRepository = production
    ? createDrizzleGuestRepository()
    : mockGuestRepository;
  const roomLockGateway = production
    ? createDrizzleRoomLockGateway(db!)
    : mockRoomLockGateway;
  try {
    // The mock and Drizzle transaction contexts are structurally unrelated,
    // so no single TContext satisfies both branches selected above.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await createMultiRoomPayAtPropertyReservation<any>({
      guestCandidate: createChannelSyncGuestCandidate(connection.platform),
      guestRepository,
      interval: event.interval,
      reservationRepository,
      rooms: [room],
      roomLockGateway,
      origin: connection.platform,
      paymentStatus:
        connection.paymentBehavior === "auto_approved" ? "approved" : "pending",
      paymentProvider:
        connection.paymentBehavior === "auto_approved"
          ? connection.platform
          : undefined,
      externalPlatform: connection.platform,
      externalRef: event.uid,
    });
    return { created: result.reservation };
  } catch (error) {
    if (error instanceof RoomLockConflictError) {
      // Ingestion-time conflict (design.md decision 5, spec "Alerta de
      // conflicto en la ingesta"): the event already occurred externally,
      // so it cannot be rejected the way a web request can — it is simply
      // not inserted, leaving the existing reservation/hold untouched, and
      // an admin alert is raised instead.
      await recordChannelSyncConflictAlert({ roomId: connection.roomId });
      return { conflict: true };
    }
    throw error;
  }
}

async function cancelDisappearedReservations(
  connection: ChannelConnection,
  currentUids: ReadonlySet<string>
): Promise<readonly ReservationRecord[]> {
  const boundary = createDatabaseBoundary();
  const production = boundary.context === "production";
  const db = production ? createProductionDatabase(boundary) : null;
  const reservationRepository = production
    ? createDrizzleReservationRepository(db!)
    : mockReservationRepository;
  const roomLockGateway = production
    ? createDrizzleRoomLockGateway(db!)
    : mockRoomLockGateway;
  const reservationRecords = production
    ? await db!
        .select({ id: reservations.id })
        .from(reservations)
        .innerJoin(
          reservationItems,
          eq(reservationItems.reservationId, reservations.id)
        )
        .where(
          and(
            eq(reservations.externalPlatform, connection.platform),
            eq(reservationItems.roomId, connection.roomId),
            eq(reservations.status, "confirmed")
          )
        )
        .then((rows) =>
          Promise.all(
            rows.map((row) => reservationRepository.getReservationById(row.id))
          )
        )
        .then((rows) =>
          rows.filter((row): row is ReservationRecord => Boolean(row))
        )
    : ((await mockReservationRepository.listReservations?.()) ?? []);
  const disappeared = reservationRecords.filter(
    (r) =>
      r.externalPlatform === connection.platform &&
      r.externalRef &&
      r.status === "confirmed" &&
      r.items.some((item) => item.roomId === connection.roomId) &&
      !currentUids.has(r.externalRef)
  );

  const cancelled: ReservationRecord[] = [];
  for (const reservation of disappeared) {
    // Same mock/Drizzle context mismatch as createReservationFromEvent above.
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const result = await transitionReservationState<any>({
      reservationId: reservation.id,
      reservationRepository: reservationRepository as any,
      roomLockGateway: roomLockGateway as any,
      to: "cancelled",
    });
    /* eslint-enable @typescript-eslint/no-explicit-any */
    cancelled.push(result);
  }
  return Object.freeze(cancelled);
}

/**
 * Ingests one connection's inbound `.ics` document: creates a reservation
 * for every new event (spec "Ingesta entrante crea reservas reales"),
 * skips events already represented by a reservation (spec "Identificación
 * idempotente de eventos entrantes"), and cancels reservations whose event
 * disappeared from the feed (spec "Cancelación por desaparición del evento
 * externo"). Mock-only for now — see `outbound-feed-source.ts` for the
 * same scoping note on the production adapter.
 */
export async function ingestChannelConnection(
  connection: ChannelConnection,
  icalDocument: string
): Promise<ChannelSyncIngestResult> {
  const events = parseInboundIcalEvents(icalDocument);
  const created: ReservationRecord[] = [];
  let skippedExisting = 0;
  let conflicts = 0;

  for (const event of events) {
    const existing = await findExistingByExternalRef(
      connection.platform,
      event.uid
    );
    if (existing) {
      skippedExisting += 1;
      continue;
    }
    const outcome = await createReservationFromEvent(connection, event);
    if (outcome.created) created.push(outcome.created);
    if (outcome.conflict) conflicts += 1;
  }

  const cancelled = await cancelDisappearedReservations(
    connection,
    new Set(events.map((event) => event.uid))
  );

  return Object.freeze({
    created: Object.freeze(created),
    skippedExisting,
    conflicts,
    cancelled,
  });
}
