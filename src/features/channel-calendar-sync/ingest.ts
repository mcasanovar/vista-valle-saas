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
import { recordChannelSyncConflictAlert } from "./conflict-alerts";
import type { ChannelConnection } from "./connections";
import { createChannelSyncGuestCandidate } from "./guest-placeholder";
import { parseInboundIcalEvents, type InboundIcalEvent } from "./inbound-parser";

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
  const reservations = (await mockReservationRepository.listReservations?.()) ?? [];
  return reservations.find(
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

  try {
    const result = await createMultiRoomPayAtPropertyReservation({
      guestCandidate: createChannelSyncGuestCandidate(connection.platform),
      guestRepository: mockGuestRepository,
      interval: event.interval,
      reservationRepository: mockReservationRepository,
      rooms: [room],
      roomLockGateway: mockRoomLockGateway,
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
      recordChannelSyncConflictAlert({ roomId: connection.roomId });
      return { conflict: true };
    }
    throw error;
  }
}

async function cancelDisappearedReservations(
  connection: ChannelConnection,
  currentUids: ReadonlySet<string>
): Promise<readonly ReservationRecord[]> {
  const reservations = (await mockReservationRepository.listReservations?.()) ?? [];
  const disappeared = reservations.filter(
    (r) =>
      r.externalPlatform === connection.platform &&
      r.externalRef &&
      r.status === "confirmed" &&
      r.items.some((item) => item.roomId === connection.roomId) &&
      !currentUids.has(r.externalRef)
  );

  const cancelled: ReservationRecord[] = [];
  for (const reservation of disappeared) {
    const result = await transitionReservationState({
      reservationId: reservation.id,
      reservationRepository: mockReservationRepository,
      roomLockGateway: mockRoomLockGateway,
      to: "cancelled",
    });
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
